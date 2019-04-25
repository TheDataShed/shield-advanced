# aws-lambda-drt-removal

Invoked by an AWS Lambda.

The AWS Lambda should be configured to pass the following variable into the function code:

`flowLogsS3           = the name of the S3 bucket where VPC flow logs are written to`

`shieldendpointregion = us-east-1`

This repo contains a `Node.js` function which can be injected into the deployment of the Lambda function, whether
this is via Cloudformation, Terraform, Serverless or another Infrastructure Code framework.

The function has been confirmed to work with `Node.js 8.10` runtime within Lambda. At the time of writing, this is highest runtime version available within AWS Lambda for `Node.js`.

## What it does?

This will be used once a DDoS incident is confirmed as resolved.

The Lambda will should be manually invoked.

- Once the Lambda is invoked, it will remove all DRT IAM roles and S3 bucket access
which were added by the `shield-engagement` Lambda.

## Building the function

Whether this is done locally or via an automated CI pipeline, the client will first off require NPM (https://www.npmjs.com/get-npm)

Then run the following in the order listed:

- `npm install` (this will install all of the Dev dependancies required for the function)
- `npm prune --production` (as Lambda will already have the AWS Javascript SDK dependancies installed, this will remove these leaving only the essentials which are required, beyond those which the Lambda will already have)
- `zip -r aws-lambda-drt-removal.zip index.js node_modules` (this will package up the function into a ZIP archive which you should then feed into the Lambda configuration)

## What IAM permissions does the AWS Lambda require to run?

You should create an IAM role which the Lambda uses as an execution role. This role should have a trusted relationship to AWS Lambda as per:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LambdaAssumeRolePolicy",
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

This role should then be granted the following:

- Allow: shield:DisassociateDRTRole
- Allow: shield:DisassociateDRTLogBucket
- Allow: logs:PutLogEvents (limited to the Cloudwatch Log Group ARN which you create for the Lambda invokation logs - *recommended)
- Allow: logs:CreateLogStream (limited to the Cloudwatch Log Group ARN which you create for the Lambda invokation logs - *recommended)
- Allow: s3:PutBucketPolicy (limited to the S3 bucket ARN which contains VPC flow logs)
- Allow: s3:GetBucketPolicy (limited to the S3 bucket ARN which contains VPC flow logs)
- Allow: s3:DeleteBucketPolicy (limited to the S3 bucket ARN which contains VPC flow logs)
