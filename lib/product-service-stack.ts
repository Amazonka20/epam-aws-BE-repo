import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const logRetention = logs.RetentionDays.ONE_DAY;

    const getProductsList = new lambda.Function(this, 'GetProductsListFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getProductsList.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../handlers')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
      },
      logRetention,
    });

    const getProductsById = new lambda.Function(this, 'GetProductsByIdFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getProductsById.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../handlers')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
      },
      logRetention,
    });

    const api = new apigw.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [process.env.CORS_ORIGIN ?? '*'],
        allowMethods: ['GET'],
      },
    });

    const products = api.root.addResource('products');
    products.addMethod('GET', new apigw.LambdaIntegration(getProductsList));

    const productById = products.addResource('{productId}');
    productById.addMethod('GET', new apigw.LambdaIntegration(getProductsById));

    new cdk.CfnOutput(this, 'ProductsApiUrl', {
      value: api.url ?? 'undefined',
    });
  }
}
