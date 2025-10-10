const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require("@aws-sdk/client-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const sns = new SNSClient({});
const ddbClient = new DynamoDBClient({ region: "eu-north-1" });

exports.catalogBatchProcess = async (event) => {
  console.log("Received", event.Records.length, "records");

  let successCount = 0;
  let failCount = 0;

  for (const record of event.Records) {
    try {
      const product = JSON.parse(record.body);
      console.log("Processing product", product);

      const command = new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.PRODUCTS_TABLE,
              Item: {
                id: { S: product.id },
                title: { S: product.title },
                price: { N: String(product.price) },
                category: { S: product.category || "general" },
              },
            },
          },
          {
            Put: {
              TableName: process.env.STOCKS_TABLE,
              Item: {
                product_id: { S: product.id },
                count: { N: String(product.count) },
              },
            },
          },
        ],
      });

      await ddbClient.send(command);

      await sns.send(
        new PublishCommand({
          TopicArn: process.env.CREATE_PRODUCT_TOPIC_ARN,
          Subject: "New product created",
          Message: JSON.stringify(product),
          MessageAttributes: {
            category: {
              DataType: "String",
              StringValue: product.category || "general",
            },
          },
        })
      );

      console.log("SNS message sent for:", product.title);
      successCount++;
    } catch (err) {
      console.error("Error processing record:", err);
      failCount++;
    }
  }

  console.log(
    `Batch processed: ${successCount} succeeded, ${failCount} failed (total ${event.Records.length})`
  );

  return { statusCode: 200 };
};
