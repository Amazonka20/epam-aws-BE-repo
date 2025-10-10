import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const logRetention = logs.RetentionDays.ONE_DAY;

    const productsTable = dynamodb.Table.fromTableName(
      this,
      "ProductsTable",
      "products"
    );
    const stockTable = dynamodb.Table.fromTableName(
      this,
      "StockTable",
      "stock"
    );

    const catalogItemsQueue = new sqs.Queue(this, "catalogItemsQueue", {
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: {
        queue: new sqs.Queue(this, "catalogItemsDLQ"),
        maxReceiveCount: 3,
      },
    });
    new cdk.CfnOutput(this, "CatalogItemsQueueArn", {
      value: catalogItemsQueue.queueArn,
      exportName: "CatalogItemsQueueArn",
    });

    new cdk.CfnOutput(this, "CatalogItemsQueueUrl", {
      value: catalogItemsQueue.queueUrl,
      exportName: "CatalogItemsQueueUrl",
    });

    const catalogBatchProcess = new lambda.Function(
      this,
      "catalogBatchProcess",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "catalogBatchProcess.catalogBatchProcess",
        code: lambda.Code.fromAsset(path.join(__dirname, "../handlers")),
        timeout: cdk.Duration.seconds(30),
        memorySize: 128,
        environment: {
          PRODUCTS_TABLE: productsTable.tableName,
          STOCKS_TABLE: stockTable.tableName,
        },
        logRetention,
      }
    );

    catalogBatchProcess.addEventSource(
      new SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
      })
    );

    productsTable.grantWriteData(catalogBatchProcess);
    stockTable.grantWriteData(catalogBatchProcess);

    const getProductsList = new lambda.Function(this, "GetProductsListFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "getProductsList.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../handlers")),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
        PRODUCTS_TABLE: productsTable.tableName,
        STOCK_TABLE: stockTable.tableName,
      },
      logRetention,
    });

    productsTable.grantReadData(getProductsList);
    stockTable.grantReadData(getProductsList);

    const getProductsById = new lambda.Function(this, "GetProductsByIdFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "getProductsById.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../handlers")),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
        PRODUCTS_TABLE: productsTable.tableName,
        STOCK_TABLE: stockTable.tableName,
      },
      logRetention,
    });

    productsTable.grantReadData(getProductsById);
    stockTable.grantReadData(getProductsById);

    const createProduct = new lambdaNodejs.NodejsFunction(
      this,
      "CreateProductFn",
      {
        entry: path.join(__dirname, "../handlers/createProduct.js"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: {
          CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
          PRODUCTS_TABLE: productsTable.tableName,
          STOCK_TABLE: stockTable.tableName,
        },
        logRetention,
      }
    );

    productsTable.grantWriteData(createProduct);
    stockTable.grantWriteData(createProduct);

    const api = new apigw.RestApi(this, "ProductsApi", {
      restApiName: "Products Service",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [process.env.CORS_ORIGIN ?? "*"],
        allowMethods: ["GET"],
      },
    });

    const products = api.root.addResource("products");
    products.addMethod("GET", new apigw.LambdaIntegration(getProductsList));
    products.addMethod("POST", new apigw.LambdaIntegration(createProduct));

    const productById = products.addResource("{productId}");
    productById.addMethod("GET", new apigw.LambdaIntegration(getProductsById));

    new cdk.CfnOutput(this, "ProductsApiUrl", {
      value: api.url ?? "undefined",
    });

    const createProductTopic = new sns.Topic(this, "createProductTopic", {
      displayName: "Product creation notifications",
    });

    createProductTopic.addSubscription(
      new subs.EmailSubscription("polinavinnikova0@gmail.com")
    );

    createProductTopic.addSubscription(
      new subs.EmailSubscription("polinavinnikova0@gmail.com", {
        filterPolicy: {
          category: sns.SubscriptionFilter.stringFilter({
            allowlist: ["coffee"],
          }),
        },
      })
    );

    createProductTopic.grantPublish(catalogBatchProcess);

    catalogBatchProcess.addEnvironment(
      "CREATE_PRODUCT_TOPIC_ARN",
      createProductTopic.topicArn
    );
  }
}
