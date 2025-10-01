const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

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
        const productsRes = await ddbDocClient.send(
            new ScanCommand({ TableName: productsTable })
        );
        const stockRes = await ddbDocClient.send(
            new ScanCommand({ TableName: stockTable })
        );

        const products = productsRes.Items ?? [];
        const stock = stockRes.Items ?? [];

        const result = products.map((p) => {
            const s = stock.find((st) => st.product_id === p.id);
            return {
                id: p.id,
                title: p.title,
                description: p.description,
                price: p.price,
                count: s?.count ?? 0,
            };
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result),
        };
    } catch (err) {
        console.error("Error in getProductsList:", err);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
};