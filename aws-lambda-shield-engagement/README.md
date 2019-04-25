# aws-lambda-shield-engagement

Invoked by an AWS Lambda.   

The AWS Lambda should be configured to pass the following variable into the function code:

`severity             = urgent`

`shield               = advanced`

`test                 = off`

`standardSubject      = http://s3.amazonaws.com/aws-shield-lambda/EngagementSubject.txt`

`standardMessage      = http://s3.amazonaws.com/aws-shield-lambda/EngagementBody.txt`

`drtRoleArn           = the ARN of the IAM role which will grant DRT access to the AWSShieldDRTAccessPolicy policy - this is an 'out of the' AWS pre-configured policy. You should create this IAM role and attach the AWSShieldDRTAccessPolicy policy`

`flowLogsS3           = the name of the S3 bucket where VPC flow logs are written to`

`shieldendpointregion = us-east-1`

This repo contains a `Node.js` function which can be injected into the deployment of the Lambda function, whether
this is via Cloudformation, Terraform, Serverless or another Infrastructure Code framework.

The function has been confirmed to work with `Node.js 8.10` runtime within Lambda. At the time of writing, this is highest runtime version available within AWS Lambda for `Node.js`.

## What it does?

This can be used during a DDoS detection (with a Shield Advanced deployment) and will carry out the following in 
an automated fashion in order to save the analyst/engineer time during a crucial diagnostics/resolution period:

- Checks the `test` flag and if this is set to `off` then publish a message to the live SNS topic managed by AWS 
(outside of our AWS accounts), to request DRT assistance. Otherwise, it will send a message to a 'test' SNS topic and 
this will not engage the DRT. This is useful for testing the Lambda in a Dev type environment.
- Be careful with running tests with this Lambda function when the test variable is set to off. If this is not a genuine DDoS incident, DRT are likely to bar your access from the Shield Advanced service if this becomes a regularity. This is to prevent abuse of the service.
- The function will always pull a pre-created message and subject from two separate text files, again from a S3
bucket owned in one of AWS' accounts. This message is fed through to a support case where the context of the
subject and message depends on whether you are a Shield Advanced customer or not (two different pre-created
subjects and messages). Basically, this determines whether you get the support of the DRT or not.
- Once the subject and message file are pulled from S3, a support case is created based on this with a severity 
of `urgent`. This is set by the environment variables set by the Lambda itself (`process.env.severity`).
- Grants the DRT an IAM role which gives them full access to Shield, full write, permissions management and read 
access to WAF global and regional, list and read access to Route53. This access is based on a AWS pre-created 
policy within each of our AWS accounts (`AWSShieldDRTAccessPolicy`).
- Finally, the DRT are then granted for GET and LIST permissions to each of the defined VPCs S3 based flow logs.
- When the DDoS incident is declared as resolved, a separate Lambda `drt-removal` can be invoked manaully, to 
remove the DRT permissions from the AWS account in question.

## The DRT are whom?

AWS' in house DDoS Response Team - highly skilled and experienced security analysts and engineers, whose role it 
is to support customers in mitigating DDoS attacks against services hosted within AWS.

## How do AWS respond when all of this happens?

- AWS will update the create support ticket with an Amazon Chime conference call link. The customer will join this call, where the DRT will be present and an AWS support analyst.
- If the customer has already carried out initial diagnostics of what the traffic profile looks like, 
along with details of the affect resources/services in the AWS stack, they should provide this.
- DRT will get to work further analysing the DDoS traffic and then give advice of what mitigations need to be put in 
place (if not there already), in order to stop the DDoS traffic saturating the target application (which is 
leading to making this unstable). 
- Following the advice, DRT will most likely apply the mitigations (typically in the form of WAF rules). BUT, they 
will not apply these on the customer's behalf until they have discussed and agreed this with the customer.
- The support case/assistance from DRT will remain in place until the mitigations have proved to stop DDoS traffic. 
There will be some on-going analysis of traffic which is carried out by both DRT and the customer.
- The DRT support may be over hours, days or weeks (depending on the severity of the attack).

## Building the function

Whether this is done locally or via an automated CI pipeline, the client will first off require NPM (https://www.npmjs.com/get-npm)

Then run the following in the order listed:

- `npm install` (this will install all of the Dev dependancies required for the function)
- `npm prune --production` (as Lambda will already have the AWS Javascript SDK dependancies installed, this will remove these leaving only the essentials which are required, beyond those which the Lambda will already have)
- `zip -r aws-lambda-shield-engagement.zip index.js node_modules` (this will package up the function into a ZIP archive which you should then feed into the Lambda configuration)

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
- Allow: support:*
- Allow: logs:PutLogEvents (limited to the Cloudwatch Log Group ARN which you create for the Lambda invokation logs - *recommended)
- Allow: logs:CreateLogStream (limited to the Cloudwatch Log Group ARN which you create for the Lambda invokation logs - *recommended)
- Allow: s3:PutBucketPolicy (limited to the S3 bucket ARN which contains VPC flow logs)
- Allow: s3:GetBucketPolicy (limited to the S3 bucket ARN which contains VPC flow logs)
- Allow: sns:Publish (limited to the SNS topics within the AWS DRT owned account - `arn:aws:sns:us-east-1:832974201822:*`)
- Allow: iam:PassRole (limited to the IAM role which you have already created to grant the DRT the required access)
- Allow: iam:ListAttachedRolePolicies (limited to the IAM role which you have already created to grant the DRT the required access)
- Allow: iam:GetRole (limited to the IAM role which you have already created to grant the DRT the required access)

## Invoking the Lambda

This can either be on a manual basis, when assistance from the DRT is required.

Alternatively, it could be triggered by a Cloudwatch Event when Shield Advanced detects suspicious traffic profiles. But please be aware that every time the Lambda is triggered, this will create a new support ticket and send a message to the DRT SNS topic. The `Node.js` could be furhter extended to check if a support ticket already exists (and open) for a DRT assistance request and if does, then not to continue with the logging the support ticket. 

Adding a check to the `createCase` and `snsPublish` function which will check if a support case with the DRT has 
already been created. If it has, then stop and do not create support case nor push to the DRT SNS topic. This 
will allow the Lambda to be automatically triggered by the Cloudwatch alarm which notifies of suspected DDoS traffic. 
The Lambda will be manually invoked at the moment, when required.
