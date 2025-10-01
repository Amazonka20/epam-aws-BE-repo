const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const productsTable = process.env.PRODUCTS_TABLE;
const stockTable = process.env.STOCK_TABLE;

exports.handler = async (event) => {
  const { productId } = event.pathParameters || {};

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  };

  if (!productId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Product ID is required" }),
    };
  }

  try {
    const productRes = await ddbDocClient.send(
      new GetCommand({
        TableName: productsTable,
        Key: { id: productId },
      })
    );

    if (!productRes.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    const stockRes = await ddbDocClient.send(
      new GetCommand({
        TableName: stockTable,
        Key: { product_id: productId },
      })
    );

    const result = {
      ...productRes.Item,
      count: stockRes.Item?.count ?? 0,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Error in getProductsById:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
