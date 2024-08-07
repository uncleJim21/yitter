const { usd_to_millisats } = require("./common");
const { getBitcoinPrice } = require("./bitcoinPrice");
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const { uploadFileToSpaces } = require('./cloudStorageUtils');



// for sanitizing
const {
  YTDL_SCHEMA
} = require('../const/serviceSchema');
const { randomUUID } = require("crypto");

// not needed since data is not passed directly to the apil
function sanitizeData(data, schema) {
  if (schema.type === "object" && schema.properties) {
      const newObj = {};
      for (const key in schema.properties) {
          if (data.hasOwnProperty(key)) {
              newObj[key] = sanitizeData(data[key], schema.properties[key]);
          }
      }
      return newObj;
  } else if (schema.type === "array" && schema.items) {
      if (Array.isArray(data)) {
          return data.map(item => sanitizeData(item, schema.items));
      }
      return [];
  } else {
      return data;
  }
}

async function getServicePrice(service) {
  const bitcoinPrice = await getBitcoinPrice(); 
  switch (service) {
    case "YTDL":
      return usd_to_millisats(process.env.YTDL_USD,bitcoinPrice);
    case "make_clip":
      return usd_to_millisats(process.env.MAKE_CLIP_USD,bitcoinPrice);
    default:
      return usd_to_millisats(process.env.YTDL_USD,bitcoinPrice);
  }
}

async function submitService(service, data) {
  switch (service) {
    case "YTDL":
      return await callYitter(data);
    case "make_clip":
      return await callMakeClip(data);
    default:
      return await callYitter(data);
  }
}


async function callYitter(data) {
  return new Promise((resolve, reject) => {
    console.log(`callYitter data:`, data);
    const videoId = data.videoId;
    const audioOnly = data?.audioOnly;

    console.log(`callYitter videoId:${videoId}`);
    console.log(`callYitter audioOnly:${audioOnly}`);

    // ScraperAPI proxy configuration
    const proxyHost = 'proxy-server.scraperapi.com';
    const proxyPort = 8001;
    const proxyUser = 'scraperapi.country_code=us.device_type=desktop.session_number=1';
    const proxyPass = process.env.SCRAPER_API_KEY; // Make sure to set this environment variable

    // Construct the proxy URL
    const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;

    // Construct the yt-dlp command
    const format = audioOnly ? 'bestaudio' : 'best[ext=mp4]';
    const command = `yt-dlp -vU -f ${format} -g --no-warnings --proxy "${proxyUrl}" --no-check-certificate https://www.youtube.com/watch?v=${videoId}`;

    // Execute the yt-dlp command
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing yt-dlp: ${error}`);
        console.error(`stderr: ${stderr}`);
        reject({ error: 'Failed to fetch video URL', details: stderr });
      } else if (stderr) {
        console.warn(`yt-dlp warning: ${stderr}`);
      }
      if (stdout.trim()) {
        const url = stdout.trim();
        console.log(`URL extracted:`, url);
        resolve({ 
          video_url: url,
          is_audio_only: audioOnly
        });
      } else {
        reject({ error: 'No URL extracted', details: 'yt-dlp output was empty' });
      }
    });
  });
}

async function getVideoDuration(url) {
  const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${url}"`;
  const { stdout } = await execPromise(command);
  return parseFloat(stdout.trim());
}

function generateFilename(videoId) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  return `${videoId}-${year}-${month}-${day}-${hours}-${minutes}.mp4`;
}

async function callMakeClip(data) {
  const clipsDir = './clips';
  const videoId = data.videoId;
  const clipRanges = data.clipRanges;
  const clipFiles = [];
  console.log("callMakeClip data:", JSON.stringify(data, null, 2));

  if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
  }

  const videoData = await callYitter({ videoId });
  const videoUrl = videoData.video_url;

  if (!videoUrl) {
    throw new Error('Failed to retrieve video URL');
  }

  for (const [index, range] of clipRanges.entries()) {
    const outputPath = path.join(clipsDir, `${videoId}_clip_${index + 1}.mp4`);
    clipFiles.push(outputPath);

    // Ensure both start and end times are defined and valid
    // if (!range.start || !range.end || range.start >= range.end) {
    //   console.error(`Invalid range for clip ${index + 1}: start=${range.start}, end=${range.end}`);
    //   return({error:'clip range error'});; // Skip this iteration if the range is invalid
    // }

    let clipCommand = `ffmpeg -ss ${range.start} `;
    if (range.end) {
        clipCommand += `-to ${range.end} `;
    }
    clipCommand += `-i "${videoUrl}" -s 852x480 -c:v libx264 -crf 23 -preset fast "${outputPath}"`;

    await new Promise((resolve, reject) => {
        exec(clipCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error creating clip ${index + 1}: ${stderr}`);
                reject(error);
            } else {
                console.log(`Clip ${index + 1} created successfully at ${outputPath}`);
                resolve();
            }
        });
    });
  }

  if(clipFiles.length === 1){
    const destFileName = generateFilename(videoId);
    const uploadUrl = await uploadFileToSpaces(clipFiles[0], 'cascdr-chads-stay-winning', destFileName);
    console.log('File uploaded successfully:', uploadUrl);

    // Clean up
    clipFiles.forEach(file => fs.unlinkSync(file));
    const resultUrl = `${process.env.SPACES_CDN_BASE_URL}/${destFileName}`
    return { resultUrl: resultUrl };
  }
  else{
    const fileListContent = clipFiles.map(file => `file '${path.relative(clipsDir, file)}'`).join('\n');
    const listFilePath = path.join(clipsDir, `${videoId}_filelist.txt`);
    fs.writeFileSync(listFilePath, fileListContent);

    const mergedFilePath = path.join(clipsDir, `${videoId}_merged.mp4`);
    const mergeCommand = `ffmpeg -f concat -safe 0 -i "${listFilePath}" -c:v libx264 -crf 23 -preset fast "${mergedFilePath}"`;

    try {
        await new Promise((resolve, reject) => {
            exec(mergeCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error during merging: ${stderr}`);
                    reject(new Error(`Error during merging: ${error.message}`));
                } else {
                    console.log('Merged clip created successfully:', mergedFilePath);
                    resolve();
                }
            });
        });
        // Upload the merged file to cloud storage
        const bucketName = 'cascdr-chads-stay-winning'
        const destFileName = generateFilename(videoId);
        const uploadUrl = await uploadFileToSpaces(mergedFilePath,bucketName,destFileName);
        console.log('File uploaded successfully:', uploadUrl);

        // Clean up
        fs.unlinkSync(listFilePath);
        clipFiles.forEach(file => fs.unlinkSync(file));
        fs.unlinkSync(mergedFilePath);
        const resultUrl = `${process.env.SPACES_CDN_BASE_URL}/${destFileName}`
        return { resultUrl: resultUrl };
    } catch (error) {
        console.error('Error in merging or uploading clips:', error);
        throw error;
    }
  }

  
}


module.exports = { 
  submitService, 
  getServicePrice,
  callMakeClip, 
  // callYitter
 };