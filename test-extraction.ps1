Write-Host "Testing LinkedIn Contact Extraction" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Test single extraction
$testUrl = "https://www.linkedin.com/in/reidhoffman"
Write-Host "`nTesting single extraction for: $testUrl" -ForegroundColor Yellow

$body = @{
    linkedinUrl = $testUrl
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/extract-contact" -Method POST -Body $body -ContentType "application/json"
    Write-Host "`nExtraction successful!" -ForegroundColor Green
    Write-Host "Name: $($response.contact.name)" -ForegroundColor White
    Write-Host "Job Title: $($response.contact.title)" -ForegroundColor White
    Write-Host "Company: $($response.contact.company)" -ForegroundColor White
    Write-Host "Email: $($response.contact.email)" -ForegroundColor White
    Write-Host "Phone: $($response.contact.phone)" -ForegroundColor White
} catch {
    Write-Host "`nExtraction failed: $_" -ForegroundColor Red
}

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 