const fs = require('fs');
const path = require('path');
// require('dotenv').config({ path: '../.env' })
const { S3Client, PutObjectCommand,ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3'); // Import the necessary AWS SDK components

// Function to upload a file to your DigitalOcean Space
const uploadFileToSpaces = async (filePath, bucketName, key) => {
    const fileStream = fs.createReadStream(filePath); // Read the file from your file system
    // Create an S3 client instance for DigitalOcean Spaces
    const s3Client = new S3Client({
        endpoint: "https://nyc3.digitaloceanspaces.com", // Your DigitalOcean Spaces endpoint
        region: "us-east-1", // 'us-east-1' is a placeholder; use your actual region
        credentials: {
            accessKeyId: process.env.SPACES_ACCESS_KEY_ID, // Use environment variables for security
            secretAccessKey: process.env.SPACES_SECRET
        }
    });

    const uploadParams = {
        Bucket: `cascdr-chads-stay-winning`, // Your Space name
        Key: key, // The path and filename to save as in your Space
        Body: fileStream, // The file data
        ACL: 'public-read', // Access control for the file
    };

    try {
        const data = await s3Client.send(new PutObjectCommand(uploadParams));
        console.log("Successfully uploaded object: " + uploadParams.Bucket + "/" + uploadParams.Key);
        return data; // Returns the response from the Spaces API
    } catch (err) {
        console.error("Error", err);
        throw err; // Throw the error so you can handle it where you call this function
    }
};

const deleteOldFilesFromSpaces = async (days) => {
    const now = Date.now();
    const cutoffTime = now - (days * 24 * 60 * 60 * 1000);
    const bucketName = `cascdr-chads-stay-winning`;
  
    try {
      const listParams = {
        Bucket: bucketName,
      };
      const s3Client = new S3Client({
        endpoint: "https://nyc3.digitaloceanspaces.com", // Your DigitalOcean Spaces endpoint
        region: "us-east-1", // 'us-east-1' is a placeholder; use your actual region
        credentials: {
            accessKeyId: process.env.SPACES_ACCESS_KEY_ID, // Use environment variables for security
            secretAccessKey: process.env.SPACES_SECRET
        }
    });
      const data = await s3Client.send(new ListObjectsV2Command(listParams));
  
      if (data.Contents) {
        for (const item of data.Contents) {
          const lastModified = new Date(item.LastModified).getTime();
  
          if (lastModified < cutoffTime) {
            const deleteParams = {
              Bucket: bucketName,
              Key: item.Key,
            };
  
            await s3Client.send(new DeleteObjectCommand(deleteParams));
            console.log(`Deleted file ${item.Key} from bucket ${bucketName} as it was older than ${days} days.`);
          }
        }
      }
    } catch (err) {
      console.error("Error", err);
    }
  };

  const deleteOldLocalFiles = (days) => {
    const directory = './clips'
    const now = Date.now();
    const cutoffTime = now - (days * 24 * 60 * 60 * 1000);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
  
    fs.readdir(directory, (err, files) => {
      if (err) {
        console.error(`Error reading directory ${directory}:`, err);
        return;
      }
  
      files.forEach(file => {
        const filePath = path.join(directory, file);
  
        fs.stat(filePath, (err, stats) => {
          if (err) {
            console.error(`Error reading file stats for ${filePath}:`, err);
            return;
          }
  
          if (stats.mtimeMs < cutoffTime) {
            fs.unlink(filePath, err => {
              if (err) {
                console.error(`Error deleting file ${filePath}:`, err);
              } else {
                console.log(`Deleted file ${filePath} as it was older than ${days} days.`);
              }
            });
          }
        });
      });
    });
  };
  
module.exports = {
    uploadFileToSpaces,
    deleteOldFilesFromSpaces,
    deleteOldLocalFiles
};

