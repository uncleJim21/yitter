const fs = require('fs');
// require('dotenv').config({ path: '../.env' })
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'); // Import the necessary AWS SDK components

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


module.exports = {
    uploadFileToSpaces
}
