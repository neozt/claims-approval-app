# Get user input for stack name
$stack_name = Read-Host "Enter the name of the CloudFormation stack:"

# Get all stack outputs from CloudFormation
Write-Host "Fetching outputs for stack: $stack_name..."
$outputs_json = aws cloudformation describe-stacks --stack-name $stack_name --query "Stacks[0].Outputs" --output json
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to fetch stack outputs. Please check the stack name and your AWS credentials."
    exit $LASTEXITCODE
}

$outputs = $outputs_json | ConvertFrom-Json
$outputMap = @{}
foreach ($out in $outputs) {
    $outputMap[$out.OutputKey] = $out.OutputValue
}

# Extract specific values needed for deployment
$api_gateway_endpoint = $outputMap["ClaimsApiUrl"]
$cloudfront_distribution_id = $outputMap["CloudFrontDistributionId"]
$s3_bucket_name = $outputMap["WebS3BucketName"]

if (-not $s3_bucket_name -or -not $cloudfront_distribution_id) {
    Write-Error "Required outputs (WebS3BucketName or CloudFrontDistributionId) not found in stack."
    exit 1
}

# Output the results
Write-Host "API Gateway URL: $api_gateway_endpoint"
Write-Host "CloudFront Distribution ID: $cloudfront_distribution_id"
Write-Host "S3 Bucket Name: $s3_bucket_name"

# Prepare dist directory
if (Test-Path "dist") {
    Write-Host "Cleaning dist directory..."
    Remove-Item -Path "dist" -Recurse -Force
}
New-Item -ItemType Directory -Path "dist" -Force

Write-Host "Copying frontend files to dist..."
Copy-Item -Path "frontend/*" -Destination "dist" -Recurse

# Replace placeholders in every file in dist/
Write-Host "Replacing placeholders with CloudFormation outputs..."
$files = Get-ChildItem -Path "dist" -Recurse -File
foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $modified = $false
    foreach ($key in $outputMap.Keys) {
        $placeholder = "`${$key}"
        $value = $outputMap[$key]
        if ($content.Contains($placeholder)) {
            Write-Host "  Replacing $placeholder in $($file.Name)"
            $content = $content.Replace($placeholder, $value)
            $modified = $true
        }
    }
    if ($modified) {
        Set-Content -Path $file.FullName -Value $content
    }
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