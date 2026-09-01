const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-west-004',
    endpoint: process.env.AWS_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const corsRules = {
    Bucket: 'ldrs-temporary-movies',
    CORSConfiguration: {
        CORSRules: [
            {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3600,
            },
        ],
    },
};

async function updateCors() {
    try {
        const command = new PutBucketCorsCommand(corsRules);
        await s3Client.send(command);
        console.log('✅ CORS policy updated successfully on Backblaze B2!');
    } catch (error) {
        console.error('❌ Error updating CORS:', error.message);
    }
}

updateCors();