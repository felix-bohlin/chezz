# Starts one ladder game as a detached process (games can outlast tool timeouts) and prints the log path.
# Usage: pwsh backend/play_detached.ps1 [-Elo auto|1600]
# Wait for completion by watching the log for a line starting with "RESULT" (or errors in <log>.err).
param([string]$Elo = "auto")

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "backend/logs"
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("game-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py -or $py -like "*WindowsApps*") { $py = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" }

$p = Start-Process -FilePath $py -ArgumentList "-u", "backend/runner.py", "--elo", $Elo, "--quiet" `
    -WorkingDirectory $root -RedirectStandardOutput $log -RedirectStandardError "$log.err" `
    -WindowStyle Hidden -PassThru
Write-Output "pid=$($p.Id) log=$log"
