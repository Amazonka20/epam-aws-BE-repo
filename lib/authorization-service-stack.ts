import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly basicAuthorizerFn: lambdaNode.NodejsFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
     const logRetentionDays = logs.RetentionDays.ONE_DAY;

    this.basicAuthorizerFn = new lambdaNode.NodejsFunction(
      this,
      "BasicAuthorizerFn",
      {
        entry: "handlers/basicAuthorizer.js",
        handler: "basicAuthorizer",
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 128,
        timeout: cdk.Duration.seconds(5),
        logRetention: logRetentionDays,

        environment: {
          [process.env.GITHUB_LOGIN || "login"]: "TEST_PASSWORD",
        },
      }
    );
this.basicAuthorizerFn.addPermission("ApiGatewayInvokePermission", {
  principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
});
    new cdk.CfnOutput(this, "BasicAuthorizerArn", {
      value: this.basicAuthorizerFn.functionArn,
      exportName: "BasicAuthorizerArn",
    });
  }
}
