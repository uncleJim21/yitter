const { usd_to_millisats } = require("./common");
const { getBitcoinPrice } = require("./bitcoinPrice");
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');

// for sanitizing
const {
  YTDL_SCHEMA
} = require('../const/serviceSchema');

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

    console.log(`callYitter videoId:${videoId}`)
    console.log(`callYitter audioOnly:${audioOnly}`)
    // Construct the youtube-dl command
    const command = `youtube-dl -g${audioOnly ? ' --extract-audio' : ''} -f mp4 --verbose --force-generic-extractor https://www.youtube.com/watch?v=${videoId}`;

    // Execute the youtube-dl command
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing youtube-dl: ${error}`);
        reject({ error: 'Failed to fetch video URL' });
      } else {
        const videoUrl = stdout.trim();
        resolve({ video_url: videoUrl });
      }
    });
  });
}


async function callMakeClip(data) {
  return new Promise((resolve, reject) => {
    // Step 1: Define the path for the downloaded video
    const videoId = data.videoId;
    const clipRanges = data.clipRanges;
    const videoPath = `./clips/${videoId}.mp4`;

    // Step 2: Download the video from YouTube
    const videoStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, { quality: 'highest' });
    const fileStream = fs.createWriteStream(videoPath);

    videoStream.pipe(fileStream);

    videoStream.on('end', () => {
      console.log('Video download completed.');

      // Step 3: Process each clip range using FFmpeg
      const promises = clipRanges.map((range, index) => {
        return new Promise((innerResolve, innerReject) => {
          const output = `./clips/${videoId}_clip_${index + 1}.mp4`;
          ffmpeg(videoPath)
            .setStartTime(range.start)
            .setDuration(range.end - range.start)
            .output(output)
            .on('end', () => {
              console.log(`Clip ${index + 1} created successfully.`);
              innerResolve();
            })
            .on('error', (err) => {
              console.error('Error:', err);
              innerReject(err);
            })
            .run();
        });
      });

      // Step 4: Wait for all clips to be processed
      Promise.all(promises)
        .then(() => {
          console.log('All clips have been processed successfully.');
          resolve();
        })
        .catch(error => {
          console.error('An error occurred while processing clips:', error);
          reject(error);
        });
    });

    videoStream.on('error', (err) => {
      console.error('Failed to download the video:', err);
      reject(err);
    });
  });
};


module.exports = { submitService, getServicePrice };