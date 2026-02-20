# claims-approval-app

Demo serverless project for claims submission and approval using AWS Step Functions and Lambda.

## Tech stack
1. AWS Step Functions
2. AWS Lambda
3. AWS API Gateway
4. SAM

## How to deploy
1. Make sure Node.js, Docker and SAM CLI are installed. If not configured, run `aws configure` to configure your access key and secret.
2. Run `sam build` to build the application.
3. Run `sam deploy --guided` to deploy the application to AWS.