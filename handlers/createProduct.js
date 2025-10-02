const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const productsTable = process.env.PRODUCTS_TABLE;
const stockTable = process.env.STOCK_TABLE;

exports.handler = async (event) => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    };

    try {
        const body = JSON.parse(event.body || "{}");

        if (!body.title || !body.price || !body.count) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: "Invalid product data" }),
            };
        }

        const id = uuidv4();
        const newProduct = {
            id,
            title: body.title,
            description: body.description || "",
            price: body.price,
        };

        const newStock = {
            product_id: id,
            count: body.count,
        };

        await ddbDocClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: productsTable,
                  Item: newProduct,
                },
              },
              {
                Put: {
                  TableName: stockTable,
                  Item: newStock,
                },
              },
            ],
          })
        );

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ ...newProduct, count: body.count }),
        };

    } catch (err) {
        console.error("Error in createProduct:", err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
};
