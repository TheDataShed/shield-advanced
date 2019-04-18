# shield-advanced

Scripts and Lambdas to help with automated deployment of AWS Shield Advanced and engagement of the DRT during a DDoS incident.

## aws-lambda-shield-engagement

This can be used during a DDoS detection (with a Shield Advanced deployment) and will automatically log a support ticket to request assistance from the DRT. This is based on the Shield-Advanced Lambda as developed by AWS (https://s3.amazonaws.com/aws-shield-lambda/ShieldEngagementLambda.pdf), but has been extended to grant DRT read and write access to WAF and Shield configuration and S3 based VPC flow logs.

## aws-lambda-drt-removal

This will be used once a DDoS incident is confirmed as resolved.

The Lambda should be manually invoked.

- Once the Lambda is invoked, it will remove all DRT IAM roles and S3 bucket access
which were added by the `shield-engagement` Lambda.

## shield-advanced-add-protections

When adding any new public facing resources - which currently includes AWS Load Balancers (ALBs), Elastic IP Addresses (EIPs), Global Accelerator and 
Cloudfront distributions, you must add two additional tags to these, in order for the new resources to be 
picked up by the `add-protections.sh` script and be automatically added to Shield Advanced as a protected 
resource.

Route 53 DNS is also protected by Shield Advanced, so the same script is ran whenever a new zone is added, but
you do not need/cannot tag these.

If you are adding resources other than Route 53, ALBs or EIPs, then `add-protection.sh` script will need to 
be extended in order to add these additional resource types to Shield Advanced, along with a new set of tag
types (simular to the above).

See the comments within the `add-protections.sh Bash` script before running this, for full details on a pre-requisites and how it works.

## Test before Production!

As with any code which comes from a public repo - ensure that this is tested within the Dev/Test environment before allowing it to hit Production. Everyone's set up is slightly different, so ensure that it works for you as expected.
