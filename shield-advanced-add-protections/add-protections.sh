#!/bin/bash

#####################################################################
# Add Shield Advance resource protections
# Will add resource protections for ALB, EIPs and Route 53 Zones
# Will only add protections for resources tagged in the correct way
# See readme for correct resources tags to use
# Resource tags must be added to the resources in advance via Infrastructure Code
# See https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html 
# for region names and alias'
#####################################################################

## USAGE: ./add-protections.sh -r <region alias> -s <stack type>

## Region is where the resources required to be protected are deployed to within AWS

## Stack types should be based on the tag names which you provide to AWS resources (AWS Load Balancers, Elastic IP Addresses or Route 53 zones)
## The following tags should be added to each AWS resource which you wish to protect:


### AWS Load Balancers:

### Key: protection 
### Value: shield-advance-lb

### Key: stack 
### Value: name_of_resource 



### AWS Elastic IP Addresses:

### Key: protection 
### Value: shield-advance-eip

### Key: stack 
### Value: name_of_resource 


## Current AWS Shield management endpoint region - unlikely to ever change
shieldglobalregion="us-east-1"

while getopts ":r:s:" opt; do
  case $opt in
    r)
      region=$OPTARG
      ;;
    s)
      stack=$OPTARG
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      ;;
  esac
done

## Get all resources from a specific application stack tagged for Shield Advance protection

echo "==================================================================="
echo "Get ALB resources tagged for protection"
echo "==================================================================="
echo
echo

## Show only the resource ARNs

albarns=`aws resourcegroupstaggingapi get-resources \
    --tag-filters Key=protection,Values=shield-advance-lb Key=stack,Values=$stack \
    --region $region \
    --query ResourceTagMappingList[].ResourceARN \
    --output text`

## Apply the Shield Advance protection for each required Load Balancer ARN

echo "====================================================================================="
echo "Adding Shield Advance protection for tagged ALB resources"
echo "====================================================================================="
echo
echo

for i in $albarns
do
    echo "Adding protection for ALB resource $i"

	aws shield create-protection --name $stack-public-alb \
    --resource-arn $i \
    --region $shieldglobalregion
done

## Get all EIP resources from a specific application stack tagged for Shield Advance protection

echo "==================================================================="
echo "Get EIP resources tagged for protection"
echo "==================================================================="
echo
echo

## Show only the resource allocation ID for EIP 

eipid=`aws ec2 describe-addresses \
    --filters "Name=tag:protection,Values=shield-advance-eip","Name=tag:stack,Values=$stack" \
    --region $region \
    --query Addresses[].AllocationId \
    --output text`

## Get the number of target aws account

accountnumber=`aws sts get-caller-identity \
    --query Account \
    --output text`

## Apply the Shield Advance protection for each required EIP

echo "====================================================================================="
echo "Adding Shield Advance protection for tagged EIP resources"
echo "====================================================================================="
echo
echo

for i in $eipid
do
    echo "Adding protection for EIP resource $i"

	aws shield create-protection --name $stack-eip-$i \
    --resource-arn arn:aws:ec2:$region:$accountnumber:eip-allocation/$i \
    --region $shieldglobalregion 

done

## Get all Route 53 hosted zones for Shield Advance protection

echo "=================================================="
echo "Get all Route 53 zones"
echo "=================================================="
echo
echo

## Show only the Id of the hosted zone for Route 53

route53hostedzone=`aws route53 list-hosted-zones \
    --region $region \
    --query HostedZones[].Id \
    --output text \
    | sed 's/\/hostedzone\///g'`

## Apply the Shield Advance protection for each Route 53 zone

echo "===================================================================================="
echo "Adding Shield Advance protection for Route 53 zones"
echo "===================================================================================="
echo
echo

for i in $route53hostedzone
do
    echo "Adding protection for Route 53 hosted zone ID $i"

	aws shield create-protection --name route-53-$i \
    --resource-arn arn:aws:route53:::hostedzone/$i \
    --region $shieldglobalregion
done

echo "=========================================================================="
echo "And the environment is now DDoS protected......"
echo "=========================================================================="
