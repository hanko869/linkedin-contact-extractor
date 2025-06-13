# PowerShell script to add environment variables to Vercel

Write-Host "Adding environment variables to Vercel..." -ForegroundColor Green

# Add WIZA_API_KEY
Write-Host "Adding WIZA_API_KEY..." -ForegroundColor Yellow
$env1 = "c951d1f0b91ab7e5afe187fa747f3668524ad5e2eba2c68a912654b43682cab8"
$env1 | vercel env add WIZA_API_KEY production --force

# Add NEXT_PUBLIC_SUPABASE_URL
Write-Host "Adding NEXT_PUBLIC_SUPABASE_URL..." -ForegroundColor Yellow
$env2 = "https://rnelxyjhdlklmbhlzcou.supabase.co"
$env2 | vercel env add NEXT_PUBLIC_SUPABASE_URL production --force

# Add NEXT_PUBLIC_SUPABASE_ANON_KEY
Write-Host "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY..." -ForegroundColor Yellow
$env3 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4eWpoZGxrbG1iaGx6Y291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NDkzNTIsImV4cCI6MjA2NTMyNTM1Mn0.P7FHDMekLm49KWueI2TSvS0q5KjqHOLLppbqUX37ews"
$env3 | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --force

# Add JWT_SECRET
Write-Host "Adding JWT_SECRET..." -ForegroundColor Yellow
$env4 = "bd91a7cd5343787681e5d2a78b14a07f80247376997514e817398ad5dc30a4deeac47bef98e1d4939ba4967af548e5c75d1d124a7e7b3071d763c138fb83e6c7"
$env4 | vercel env add JWT_SECRET production --force

Write-Host "All environment variables added!" -ForegroundColor Green
Write-Host "Now run: vercel --prod" -ForegroundColor Cyan 