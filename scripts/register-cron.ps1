$ErrorActionPreference = "Stop"

$xSyncScript = Join-Path $PSScriptRoot "cron-x-sync.ps1"
$enrichScript = Join-Path $PSScriptRoot "cron-enrich.ps1"
$repetitionDuration = [TimeSpan]::MaxValue

$xSyncAction = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$xSyncScript`""
$xSyncTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 30) `
  -RepetitionDuration $repetitionDuration
Register-ScheduledTask `
  -TaskName "SeedThought-XSync" `
  -Action $xSyncAction `
  -Trigger $xSyncTrigger `
  -Description "SeedThought local X sync cron" `
  -Force

$enrichAction = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$enrichScript`""
$enrichTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Hours 1) `
  -RepetitionDuration $repetitionDuration
Register-ScheduledTask `
  -TaskName "SeedThought-Enrich" `
  -Action $enrichAction `
  -Trigger $enrichTrigger `
  -Description "SeedThought local enrichment cron" `
  -Force

Write-Host "Windows タスクスケジューラに SeedThought-XSync / SeedThought-Enrich を登録しました。"
