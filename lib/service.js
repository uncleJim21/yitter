const { usd_to_millisats } = require("./common");
const { getBitcoinPrice } = require("./bitcoinPrice");
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');
const fs = require('fs');
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
        console.log(`videoUrl made successfully:${videoUrl}`)
        resolve({ video_url: videoUrl });
      }
    });
  });
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
  return new Promise((resolve, reject) => {
    console.log(`callMakeClip with data:`, data);
    const videoId = data.videoId;
    const clipRanges = data.clipRanges;
    const clipsDir = './clips';
    const outputFilePath = `${clipsDir}/${videoId}_merged.mp4`;
    const downloadPromises = [];
    const clipFilePaths = [];

    // Step 1: Check and create the clips directory if not exists
    if (!fs.existsSync(clipsDir)) {
      fs.mkdirSync(clipsDir, { recursive: true });
    }

    // Step 2: Download only the necessary portion of the video using youtube-dl and FFmpeg
    clipRanges.forEach((range, index) => {
      const clipFilePath = `${clipsDir}/${videoId}_clip_${index + 1}.mp4`;
      clipFilePaths.push(clipFilePath);
      const command = `youtube-dl -f 'bestvideo[height<=720]+bestaudio/best[height<=720]' --merge-output-format mp4 --postprocessor-args "-ss ${range.start} -to ${range.end}" -o ${clipFilePath} https://www.youtube.com/watch?v=${videoId}`;

      const downloadPromise = new Promise((innerResolve, innerReject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error executing youtube-dl: ${error}`);
            innerReject({ error: 'Failed to download video portion' });
            return;
          }

          console.log(`Clip ${index + 1} download completed.`);
          innerResolve();
        });
      });

      downloadPromises.push(downloadPromise);
    });

    // Step 3: Wait for all downloads to complete
    Promise.all(downloadPromises)
      .then(() => {
        console.log('All clips have been downloaded successfully.');

        // Step 4: Merge all clips into one video using FFmpeg concat filter
        const ffmpegCommand = ffmpeg();

        clipFilePaths.forEach(clipFilePath => {
          ffmpegCommand.input(clipFilePath);
        });

        ffmpegCommand
          .on('end', () => {
            console.log('All clips have been merged successfully.');

            // Step 5: Upload the merged clip to the cloud
            const bucketName = 'cascdr-chads-stay-winning';
            const destFileName = generateFilename(videoId) + '_merged.mp4';
            uploadFileToSpaces(outputFilePath, bucketName, destFileName)
              .then(() => {
                console.log('Merged clip uploaded successfully.');
                const resultUrl = `${process.env.SPACES_CDN_BASE_URL}/${destFileName}`;

                // Step 6: Delete the merged clip and individual clips from local memory
                fs.unlink(outputFilePath, (err) => {
                  if (err) {
                    console.error('Failed to delete the merged video file:', err);
                    reject(err);
                    return;
                  }
                  console.log('Merged video file deleted successfully.');

                  // Delete individual clips
                  clipFilePaths.forEach((clipFilePath, index) => {
                    fs.unlink(clipFilePath, (err) => {
                      if (err) {
                        console.error(`Failed to delete clip ${index + 1}:`, err);
                      } else {
                        console.log(`Clip ${index + 1} deleted successfully.`);
                      }
                    });
                  });

                  resolve({ resultUrl });
                });
              })
              .catch(err => {
                console.error('Failed to upload merged clip:', err);
                reject(err);
              });
          })
          .on('error', (err) => {
            console.error('Error merging clips:', err);
            reject(err);
          })
          .outputOptions('-filter_complex', `concat=n=${clipFilePaths.length}:v=1:a=1`)
          .output(outputFilePath)
          .run();
      })
      .catch(error => {
        console.error('An error occurred while downloading clips:', error);
        reject(error);
      });
  });
}


module.exports = { 
  submitService, 
  getServicePrice,
  callMakeClip, 
  // callYitter
 };