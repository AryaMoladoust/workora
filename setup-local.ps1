$ErrorActionPreference = "Stop"

Write-Host "Checking MongoDB..." -ForegroundColor Cyan
$service = Get-Service -Name MongoDB -ErrorAction SilentlyContinue

if ($service) {
  if ($service.Status -ne "Running") {
    Start-Service MongoDB
    Write-Host "MongoDB service started." -ForegroundColor Green
  } else {
    Write-Host "MongoDB service is already running." -ForegroundColor Green
  }
} else {
  Write-Host "MongoDB Windows service was not found." -ForegroundColor Yellow
  Write-Host "If MongoDB is installed manually, start mongod yourself." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "1. npm install"
Write-Host "2. npm run dev"
Write-Host "3. Open http://localhost:3000/register"
