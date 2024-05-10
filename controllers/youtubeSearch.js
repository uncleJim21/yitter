const asyncHandler = require('../middleware/async');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function scrapeYouTubeSearch(searchQuery) {
  console.log('Scraping YouTube for search query: ', searchQuery);
  const encodedQuery = encodeURIComponent(searchQuery);
  const searchURL = `https://www.youtube.com/results?search_query=${encodedQuery}`;

  try {
    // Launch a headless browser instance
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigate to the YouTube search results page
    await page.goto(searchURL, { waitUntil: 'networkidle2' });

    // Extract video IDs directly from the rendered HTML
    const videoIds = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('ytd-video-renderer'));
      return items.map(item => {
        const videoId = item.querySelector('#video-title')?.href.split('v=')[1] || '';
        return videoId;
      });
    });

    // Close the Puppeteer browser
    await browser.close();

    console.log('found videoIds:', videoIds);

    // Fetch additional video information using Axios and Cheerio
    const videos = await Promise.all(videoIds.map(async (videoId) => {
      const videoURL = `https://www.youtube.com/watch?v=${videoId}`;

      try {
        const response = await axios.get(videoURL);
        const $ = cheerio.load(response.data);

        const description = $('meta[property="og:description"]').attr('content');
        const thumbnail = $('meta[property="og:image"]').attr('content');

        // Extract data from script containing video details
        const scriptContents = $('script').filter((index, element) => {
            return element.children[0]?.data.includes('ytInitialPlayerResponse');
        }).html();
        const parsedScript = JSON.parse(
            scriptContents.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/)?.[1] || '{}'
        );

        const title = parsedScript?.videoDetails?.title || '';
        const durationSeconds = parsedScript?.videoDetails?.lengthSeconds || 0;
        const duration = formatDuration(durationSeconds);
        const uploadDate = parsedScript?.microformat?.playerMicroformatRenderer?.publishDate || '';
        const channelName = parsedScript?.microformat?.playerMicroformatRenderer?.ownerChannelName || '';

        return {
          title,
          videoId,
          thumbnail,
          channelName,
          duration,
          uploadDate,
          description,
          videoURL,
        };
      } catch (error) {
        console.error(`Error fetching video info for videoId ${videoId}:`, error);
        return null;
      }
    }));

    // Filter out null values (failed requests) from the videos array
    const filteredVideos = videos.filter(video => video !== null);

    return filteredVideos;
  } catch (error) {
    console.error('Error scraping YouTube:', error);
    return [];
  }
}

// Helper function to format duration in hh:mm:ss format
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

exports.searchVideos = asyncHandler(async (req, res, next) => {
    const authAllowed = req.body?.authAllowed;
    const authCategory = req.body?.authCategory;

    try {
        if (!authAllowed) {
            res.status(402).send({ message: "Unauthorized" });
            return;
        }

        const searchQuery = req.body?.searchQuery;
        const videos = await scrapeYouTubeSearch(searchQuery); // Await the async function

        res.status(200).json({ videos, authAllowed, authCategory });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
