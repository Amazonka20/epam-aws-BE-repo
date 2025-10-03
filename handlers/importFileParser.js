const { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const csv = require('csv-parser');

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME;

exports.importFileParser = async (event) => {
  for (const record of event.Records || []) {
    try {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log('Processing file:', key);

      const getRes = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bodyStream = getRes.Body;

      await new Promise((resolve, reject) => {
        bodyStream
          .pipe(csv())
          .on('data', (row) => {
            console.log('ROW:', row); 
          })
          .on('end', resolve)
          .on('error', reject);
      });

      const parsedKey = key.replace('uploaded/', 'parsed/');
      await s3.send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: `${bucket}/${key}`, Key: parsedKey }));
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

      console.log(`File moved to ${parsedKey}`);
    } catch (err) {
      console.error('Error processing file:', err);
      throw err; 
    }
  }
};
