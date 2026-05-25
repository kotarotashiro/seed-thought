$ErrorActionPreference = "Stop"

$secret = $env:CRON_SECRET
if (-not $secret) {
  Write-Error "CRON_SECRET環境変数が未設定です"
  exit 1
}

Invoke-RestMethod -Uri "http://localhost:3000/api/cron/x-sync" `
  -Headers @{ Authorization = "Bearer $secret" } `
  -Method Get
