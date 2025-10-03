jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(() => Promise.resolve("https://signed-url"))
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({})),
  PutObjectCommand: jest.fn()
}));
const { importProductsFile } = require("../handlers/importProductsFile");

describe("importProductsFile Lambda", () => {
  beforeAll(() => {
    process.env.BUCKET_NAME = "test-bucket";
    process.env.AWS_REGION = "eu-north-1";
  });

  it("should return 400 if no file name is provided", async () => {
    const event = { queryStringParameters: {} };
    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual("Query param name is required and must end with .csv" );
  });

  it("should return signed URL when file name is provided", async () => {
    const event = { queryStringParameters: { name: "test.csv" } };
    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("https://signed-url");
  });
});
