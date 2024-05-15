const AWS = require('aws-sdk');
const { model } = require('mongoose');
const fs = require('fs');


// Set your Digital Ocean Spaces credentials and endpoint
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_ENDPOINT_NAME);
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_BUCKET_KEY_ID,
    secretAccessKey: process.env.SPACES_BUCKET_KEY
});

// Your bucket name
const bucketName = process.env.SPACES_BUCKET_NAME;


async function uploadFileToSpaces(filePath, fileKey) {
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', function(err) {
        console.log('File Error', err);
    });

    const uploadParams = {
        Bucket: bucketName,
        Key: fileKey,
        Body: fileStream,
        ACL: 'public-read' // or any ACL you prefer
    };

    // Perform the upload
    s3.upload(uploadParams, function(err, data) {
        if (err) {
            console.log('Error', err);
        }
        if (data) {
            console.log('Upload Success', data.Location);
        }
    });
}

module.exports = {uploadFileToSpaces}
