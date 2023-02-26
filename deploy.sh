cdk deploy --outputs-file output.json
appRunnerArn=$(jq -r .InvestInfrastructureStack.appRunnerArn output.json)
echo $appRunnerArn
aws apprunner update-service --service-arn $appRunnerArn --cli-input-json file://post-deploy.json
