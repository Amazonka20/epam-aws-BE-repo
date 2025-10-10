import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as sqs from "aws-cdk-lib/aws-sqs";

export class ImportServiceStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly api: apigw.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "ImportBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
        },
      ],
      lifecycleRules: [
        { prefix: "uploaded/", expiration: cdk.Duration.days(3) },
        { prefix: "parsed/", expiration: cdk.Duration.days(7) },
      ],
    });

    new s3deploy.BucketDeployment(this, "CreateUploadedPrefix", {
      destinationBucket: this.bucket,
      sources: [
        s3deploy.Source.data("uploaded/placeholder.txt", "placeholder"),
      ],
    });

    const importProductsFileFn = new lambdaNode.NodejsFunction(
      this,
      "ImportProductsFileFn",
      {
        entry: "handlers/importProductsFile.js",
        handler: "importProductsFile",
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 128,
        timeout: cdk.Duration.seconds(10),
        environment: {
          BUCKET_NAME: this.bucket.bucketName,
        },
        logRetention: logs.RetentionDays.THREE_DAYS,
      }
    );

    this.bucket.grantPut(importProductsFileFn, "uploaded/*");

    this.api = new apigw.RestApi(this, "ImportServiceApi", {
      deployOptions: { stageName: "dev" },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ["GET"],
      },
    });

    const importFileParserFn = new lambdaNode.NodejsFunction(
      this,
      "ImportFileParserFn",
      {
        entry: "handlers/importFileParser.js",
        handler: "importFileParser",
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 256,
        timeout: cdk.Duration.seconds(30),
        environment: {
          BUCKET_NAME: this.bucket.bucketName,
        },
        logRetention: logs.RetentionDays.THREE_DAYS,
      }
    );

    const catalogItemsQueueArn = cdk.Fn.importValue("CatalogItemsQueueArn");
    const catalogItemsQueueUrl = cdk.Fn.importValue("CatalogItemsQueueUrl");

    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      "ImportedCatalogItemsQueue",
      catalogItemsQueueArn
    );

    importFileParserFn.addEnvironment("CATALOG_SQS_URL", catalogItemsQueueUrl);

    catalogItemsQueue.grantSendMessages(importFileParserFn);
    this.bucket.grantRead(importFileParserFn, "uploaded/*");
    this.bucket.grantDelete(importFileParserFn, "uploaded/*");
    this.bucket.grantPut(importFileParserFn, "parsed/*");

    this.bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserFn),
      { prefix: "uploaded/", suffix: ".csv" }
    );

    const importRes = this.api.root.addResource("import");
    importRes.addMethod(
      "GET",
      new apigw.LambdaIntegration(importProductsFileFn, { proxy: true })
    );
  }
}
