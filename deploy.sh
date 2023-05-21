appRunnerArn=$(jq -r .InvestInfrastructureStack.appRunnerArn output.json)
echo $appRunnerArn
aws apprunner start-deployment --service-arn $appRunnerArn
