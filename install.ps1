# Install script for Lambda functions
# This script finds all Lambda functions with package.json in their root folder
# and runs npm install for each one

Write-Host "=== Lambda Functions Installation Script ===" -ForegroundColor Cyan
Write-Host ""

# Get the script's directory (workspace root)
$workspaceRoot = $PSScriptRoot

# Find all package.json files in immediate subdirectories only (not nested)
$lambdaFolders = Get-ChildItem -Path $workspaceRoot -Directory | Where-Object {
    Test-Path (Join-Path $_.FullName "package.json")
}

if ($lambdaFolders.Count -eq 0) {
    Write-Host "No Lambda functions found (no package.json files in root folders)" -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($lambdaFolders.Count) Lambda function(s):" -ForegroundColor Green
foreach ($folder in $lambdaFolders) {
    Write-Host "  - $($folder.Name)" -ForegroundColor White
}
Write-Host ""

# Install dependencies for each Lambda function
$successCount = 0
$failCount = 0

foreach ($folder in $lambdaFolders) {
    Write-Host "Installing dependencies for: $($folder.Name)" -ForegroundColor Cyan
    Write-Host "Location: $($folder.FullName)" -ForegroundColor Gray
    
    Push-Location $folder.FullName
    
    try {
        # Run npm install
        npm install
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Successfully installed dependencies for $($folder.Name)" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "✗ Failed to install dependencies for $($folder.Name)" -ForegroundColor Red
            $failCount++
        }
    }
    catch {
        Write-Host "✗ Error installing dependencies for $($folder.Name): $_" -ForegroundColor Red
        $failCount++
    }
    finally {
        Pop-Location
    }
    
    Write-Host ""
}

# Summary
Write-Host "=== Installation Summary ===" -ForegroundColor Cyan
Write-Host "Total Lambda functions: $($lambdaFolders.Count)" -ForegroundColor White
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red

if ($failCount -gt 0) {
    Write-Host ""
    Write-Host "Some installations failed. Please check the errors above." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host ""
    Write-Host "All dependencies installed successfully! ✓" -ForegroundColor Green
    exit 0
}
