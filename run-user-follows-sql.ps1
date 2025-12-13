# PowerShell script to execute SQL file in Supabase

Write-Host "Creating user_follows table in Supabase..." -ForegroundColor Cyan

# Read the SQL file
$sqlContent = Get-Content -Path ".\supabase\create-user-follows-table.sql" -Raw

# Display the SQL (first 500 characters)
Write-Host "`nSQL Preview:" -ForegroundColor Yellow
Write-Host $sqlContent.Substring(0, [Math]::Min(500, $sqlContent.Length))
Write-Host "..." -ForegroundColor Gray

Write-Host "`n===========================================`n" -ForegroundColor Green
Write-Host "To execute this SQL in Supabase:" -ForegroundColor Cyan
Write-Host "1. Go to https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Select your project" -ForegroundColor White
Write-Host "3. Go to SQL Editor" -ForegroundColor White
Write-Host "4. Copy and paste the content from:" -ForegroundColor White
Write-Host "   supabase\create-user-follows-table.sql" -ForegroundColor Yellow
Write-Host "5. Click 'Run' or press Ctrl+Enter" -ForegroundColor White
Write-Host "`n===========================================`n" -ForegroundColor Green

# Open SQL file in default editor
Write-Host "Opening SQL file..." -ForegroundColor Cyan
Start-Process ".\supabase\create-user-follows-table.sql"

# Open Supabase dashboard
Write-Host "Opening Supabase dashboard..." -ForegroundColor Cyan
Start-Process "https://supabase.com/dashboard"

Write-Host "`nDone! Execute the SQL in Supabase SQL Editor.`n" -ForegroundColor Green
