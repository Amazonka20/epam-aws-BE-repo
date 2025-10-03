const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME;

exports.importProductsFile = async (event) => {
  try {
    const fileName = event.queryStringParameters?.name;

    if (!fileName || !fileName.endsWith('.csv')) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'Query param name is required and must end with .csv',
      };
    }

    const key = `uploaded/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: 'text/csv',
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 60 });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: url,
    };
  } catch (err) {
    console.error('Error generating signed URL:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Internal Server Error',
    };
  }
};
