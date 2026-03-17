param (
    [string]$stack_name
)

# Get user input for stack name if not provided
if (-not $stack_name) {
    $stack_name = Read-Host "Enter the name of the CloudFormation stack"
}

# Run build script
Write-Host "Starting build process..."
. ./build_frontend.ps1 -stack_name $stack_name
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    Write-Error "Build failed. Deployment aborted."
    exit $LASTEXITCODE
}

# The build script returns the outputMap, so we can use it here
# However, in PowerShell, the return value of a script called with '.' or '&' 
# might need to be captured if we want to use variables directly.
# For simplicity and robustness, let's fetch the outputs again or rely on the build script 
# having set things correctly in dist/

# Let's fetch outputs again to be safe and clear in this script
Write-Host "Fetching outputs for deployment: $stack_name..."
$outputs_json = aws cloudformation describe-stacks --stack-name $stack_name --query "Stacks[0].Outputs" --output json
$outputs = $outputs_json | ConvertFrom-Json
$outputMap = @{}
foreach ($out in $outputs) {
    $outputMap[$out.OutputKey] = $out.OutputValue
}

$cloudfront_distribution_id = $outputMap["CloudFrontDistributionId"]
$s3_bucket_name = $outputMap["WebS3BucketName"]

if (-not $s3_bucket_name -or -not $cloudfront_distribution_id) {
    Write-Error "Required outputs (WebS3BucketName or CloudFrontDistributionId) not found in stack."
    exit 1
}

# Sync distribution with S3
Write-Host "Syncing with S3 bucket: $s3_bucket_name..."
aws s3 sync "dist/" "s3://$s3_bucket_name/" --delete

# Create cloudfront invalidation
Write-Host "Creating CloudFront invalidation for distribution: $cloudfront_distribution_id..."
$invalidation_id = aws cloudfront create-invalidation --distribution-id $cloudfront_distribution_id --paths "/*" --query "Invalidation.Id" --output text

# Wait for cloudfront invalidation to complete
Write-Host "Waiting for invalidation ($invalidation_id) to complete..."
aws cloudfront wait invalidation-completed --distribution-id $cloudfront_distribution_id --id $invalidation_id

# Get cloudfront domain name and validate
$cloudfront_domain_name = aws cloudfront list-distributions --query "DistributionList.Items[?Id=='$cloudfront_distribution_id'].DomainName" --output text

Write-Host "`nDeployment Complete!"
Write-Host "Please visit your CloudFront URL to test: https://$cloudfront_domain_name"