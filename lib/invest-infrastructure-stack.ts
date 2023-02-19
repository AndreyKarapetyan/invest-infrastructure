import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class InvestInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const handler = new NodejsFunction(this, 'MyFunction', {
      entry: path.join(__dirname, '../invest-be/apps/myapp/src/main.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_18_X,
      bundling: {
        externalModules: ['@nestjs/microservices', '@nestjs/websockets'],
      },
    });
    new LambdaRestApi(this, 'LambdaDeployment', {
      handler,
      proxy: true,
    });
  }
}
