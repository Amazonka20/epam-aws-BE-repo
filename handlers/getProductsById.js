const products = require('./products.json');

exports.handler = async (event) => {
    const { productId } = event.pathParameters || {};
    const product = products.find(p => String(p.id) === String(productId));

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    };

    if (!product) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'Product not found' })
        };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(product),
    };
};
