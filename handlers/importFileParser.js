const {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const csv = require("csv-parser");

const s3 = new S3Client({});
const sqs = new SQSClient({});
const BUCKET = process.env.BUCKET_NAME;
const QUEUE_URL = process.env.CATALOG_SQS_URL;

exports.importFileParser = async (event) => {
  for (const record of event.Records || []) {
    try {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
      console.log("Processing file:", key);

      const getRes = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      const bodyStream = getRes.Body;

      const rows = [];
      await new Promise((resolve, reject) => {
        bodyStream
          .pipe(csv())
          .on("data", (row) => rows.push(row))
          .on("end", resolve)
          .on("error", reject);
      });

      console.log(`Parsed ${rows.length} rows from ${key}`);

      for (const row of rows) {
        try {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: QUEUE_URL,
              MessageBody: JSON.stringify(row),
            })
          );
          console.log(
            "Sent to SQS:",
            row.title || row.id || JSON.stringify(row)
          );
        } catch (err) {
          console.error("Error sending message to SQS:", err);
        }
      }

      const parsedKey = key.replace("uploaded/", "parsed/");
      await s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `${bucket}/${key}`,
          Key: parsedKey,
        })
      );
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

      console.log(`File moved to ${parsedKey}`);
    } catch (err) {
      console.error("Error processing file:", err);
      throw err;
    }
  }
};
