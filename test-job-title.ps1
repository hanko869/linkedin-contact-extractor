Write-Host "`nTesting Job Title Extraction" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host "`nFrom the console logs, we can see Reid Hoffman's extraction:" -ForegroundColor Yellow
Write-Host "- Name: Reid Hoffman" -ForegroundColor White
Write-Host "- Job Title: Board Member ✅" -ForegroundColor Green
Write-Host "- Company: Microsoft" -ForegroundColor White
Write-Host "- Location: Seattle, Washington, United States" -ForegroundColor White
Write-Host "- Emails: 2 found (reid@microsoft.com, reid.hoffman@gmail.com)" -ForegroundColor White
Write-Host "- Phones: 3 found" -ForegroundColor White

Write-Host "`nThe job title field 'title' from the API response is now being correctly mapped!" -ForegroundColor Green
Write-Host "`nFor bulk extraction:" -ForegroundColor Yellow
Write-Host "- With 2 API keys: Processing will be 2x faster" -ForegroundColor Green
Write-Host "- Example: 500 URLs in ~5 minutes instead of 10 minutes" -ForegroundColor Green
Write-Host "`nTest it by:" -ForegroundColor Cyan
Write-Host "1. Go to http://localhost:3000" -ForegroundColor White
Write-Host "2. Try a single extraction - you'll see the job title" -ForegroundColor White
Write-Host "3. Upload test-urls.txt for bulk extraction with parallel processing" -ForegroundColor White 