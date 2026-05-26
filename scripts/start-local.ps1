$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Start-PnpmProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory
  )

  $pnpm = Get-Command pnpm -ErrorAction Stop
  if ($pnpm.Source.EndsWith(".ps1")) {
    Start-Process `
      -FilePath "powershell.exe" `
      -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $pnpm.Source, $Command) `
      -WorkingDirectory $WorkingDirectory `
      -WindowStyle Hidden
  } else {
    Start-Process `
      -FilePath $pnpm.Source `
      -ArgumentList $Command `
      -WorkingDirectory $WorkingDirectory `
      -WindowStyle Hidden
  }
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host "cloudflared がインストールされていません。"
  Write-Host "winget install --id Cloudflare.cloudflared でインストールしてください。"
  exit 1
}

Write-Host "Next.js 本番ビルドを実行しています..."
Push-Location $root
try {
  pnpm build
} finally {
  Pop-Location
}

Write-Host "Next.js を http://localhost:3000 で起動しています..."
Start-PnpmProcess -Command "start" -WorkingDirectory $root

Write-Host "Cloudflare Tunnel起動中... 表示されるURLをブックマークしてください。"
Write-Host "*.trycloudflare.com URLは起動ごとに変わります。"
cloudflared tunnel --url http://localhost:3000
