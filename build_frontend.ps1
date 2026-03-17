param (
    [string]$stack_name
)

# Get user input for stack name if not provided
if (-not $stack_name) {
    $stack_name = Read-Host "Enter the name of the CloudFormation stack"
}

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

Write-Host "Build complete! Files are in the 'dist' directory."
return $outputMap
