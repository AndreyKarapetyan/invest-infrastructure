import * as appRunner from '@aws-cdk/aws-apprunner-alpha';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as fs from 'fs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as rds from 'aws-cdk-lib/aws-rds';
import { CfnOutput, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime } from '@aws-cdk/aws-apprunner-alpha';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';

/* STEPS: 
    1. Deploy without App runner role and app runner
    2. Replace .env variable
    3. Deploy together */
export class InvestInfrastructureStack extends cdk.Stack {
  private vpc: ec2.Vpc;
  private dnInstance: rds.DatabaseInstance;
  private appRunnerRole: iam.Role;
  private appRunner: appRunner.Service;
  private envVariables: { [key: string]: string };

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.envVariables = this._generateEnvVariablesFromFile(path.join(__dirname, '..', '.env'));
    this.createVpc();
    this.createDbInstance();
    this.createAppRunnerRole();
    this.createAppRunner();
  }

  private createVpc() {
    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: 'Some name',
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          name: 'Another name',
        },
      ],
      maxAzs: 2,
      vpcName: 'InvestVpc',
    });
  }

  private createDbInstance() {
    const securityGroup = new ec2.SecurityGroup(this, 'MySecurityGroup', {
      vpc: this.vpc,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306));
    this.dnInstance = new rds.DatabaseInstance(this, 'MyRds', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_31,
      }),
      vpc: this.vpc,
      allocatedStorage: 5,
      databaseName: 'invest',
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      multiAz: true,
      removalPolicy: RemovalPolicy.DESTROY,
      publiclyAccessible: true,
      credentials: rds.Credentials.fromUsername(this.envVariables.DB_USERNAME, {
        password: SecretValue.unsafePlainText(this.envVariables.DB_PASSWORD),
      }),
      securityGroups: [securityGroup],
    });
    new CfnOutput(this, 'dbInstanceHostname', {
      exportName: 'dbInstanceHostname',
      value: this.dnInstance.instanceEndpoint.hostname,
    });
  }

  private createAppRunnerRole() {
    this.appRunnerRole = new iam.Role(this, 'AppRunnerRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
        new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      ),
      roleName: 'AppRunnerRole',
    });
    this.appRunnerRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rds:*'],
        resources: [this.dnInstance.instanceArn],
      }),
    );
  }

  private createAppRunner() {
    const vpcConnector = new appRunner.VpcConnector(this, 'MyVpcConnector', {
      vpc: this.vpc,
      vpcSubnets: this.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
    });
    this.appRunner = new appRunner.Service(this, 'MyAppRunner', {
      source: appRunner.Source.fromGitHub({
        configurationSource: appRunner.ConfigurationSourceType.API,
        codeConfigurationValues: {
          runtime: Runtime.NODEJS_16,
          buildCommand: 'npm i',
          startCommand: 'sh prod-start.sh',
          environmentVariables: this.envVariables,
        },
        repositoryUrl: 'https://github.com/AndreyKarapetyan/invest-be',
        branch: 'master',
        connection: appRunner.GitHubConnection.fromConnectionArn(
          'arn:aws:apprunner:eu-west-1:344658833669:connection/MyConnection/d6e8dea2eeb64a5d8ff2de0267a70bc1',
        ),
      }),
      cpu: appRunner.Cpu.ONE_VCPU,
      memory: appRunner.Memory.TWO_GB,
      instanceRole: this.appRunnerRole,
      vpcConnector,
    });
    new CfnOutput(this, 'appRunnerArn', {
      value: this.appRunner.serviceArn,
      exportName: 'appRunnerArn',
    });
  }

  private _generateEnvVariablesFromFile = (filePath: string) =>
    fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.includes('#'))
      .map((line) => line.split('='))
      .reduce((acc: { [index: string]: string }, record) => {
        acc[record[0]] = record.slice(1).join('=');
        return acc;
      }, {});
}
