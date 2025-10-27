jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({
    send: jest.fn(() => Promise.resolve({}))
  })),
  TransactWriteItemsCommand: jest.fn(function (params) {
    return params; 
  }),
}));

jest.mock("@aws-sdk/client-sns", () => ({
  SNSClient: jest.fn(() => ({
    send: jest.fn(() => Promise.resolve({ MessageId: "test-id" })),
  })),
  PublishCommand: jest.fn(function (params) {
    return params;
  }),
}));
const { catalogBatchProcess } = require("../handlers/catalogBatchProcess");

describe("catalogBatchProcess Lambda", () => {
  it("should process multiple records successfully", async () => {
    const event = {
      Records: [
        { body: JSON.stringify({ id: "1", title: "Coffee", price: 10, count: 5 }) },
        { body: JSON.stringify({ id: "2", title: "Tea", price: 8, count: 3 }) },
      ],
    };

    const result = await catalogBatchProcess(event);
    expect(result).toEqual({ statusCode: 200 }); 
  });

  it("should handle invalid JSON in record body gracefully", async () => {
    const event = {
      Records: [{ body: "invalid json" }],
    };

    await expect(catalogBatchProcess(event)).resolves.not.toThrow();
  });
});
