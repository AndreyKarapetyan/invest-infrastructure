import * as cdk from 'aws-cdk-lib';
import { InvestInfrastructureStack } from '../lib/invest-infrastructure-stack';

const app = new cdk.App();
new InvestInfrastructureStack(app, 'InvestInfrastructureStack', {
  env: {
    account: '344658833669',
    region: 'eu-central-1'
  }
});
app.synth();