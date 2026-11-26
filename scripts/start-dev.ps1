$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
$logFile = Join-Path $logs 'start-dev.log'

function Write-Log([string]$message) {
  $line = "$([DateTime]::Now.ToString('HH:mm:ss')) $message"
  $line | Out-File -Append -Encoding utf8 $logFile
  Write-Host $line
}

if (-not (docker version --format '{{.Server.Version}}' 2>$null)) {
  Write-Log 'Docker Desktop not running, starting it'
  Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    if (docker version --format '{{.Server.Version}}' 2>$null) { break }
  }
}

$engine = docker version --format '{{.Server.Version}}' 2>$null
if (-not $engine) { throw 'Docker engine is unavailable' }
Write-Log "Docker engine $engine ready"

Push-Location $root
try {
  docker compose up -d mysql redis 2>&1 | Out-Null
  $mysql = ''
  $redis = ''
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    $mysql = docker inspect -f '{{.State.Health.Status}}' leaierp-mysql 2>$null
    $redis = docker inspect -f '{{.State.Health.Status}}' leaierp-redis 2>$null
    if ($mysql -eq 'healthy' -and $redis -eq 'healthy') { break }
  }
  if ($mysql -ne 'healthy' -or $redis -ne 'healthy') { throw "Containers not healthy: mysql=$mysql redis=$redis" }
  Write-Log 'mysql/redis healthy'
} finally {
  Pop-Location
}

function Start-Detached([string]$workingDirectory, [string]$commandLine, [string]$outLog, [string]$errLog) {
  $cmd = "cd /d `"$workingDirectory`" && $commandLine > `"$outLog`" 2> `"$errLog`""
  $psi = [System.Diagnostics.ProcessStartInfo]::new('cmd.exe', "/c $cmd")
  $psi.UseShellExecute = $true
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  return [System.Diagnostics.Process]::Start($psi).Id
}

$apiId = Start-Detached `
  -workingDirectory (Join-Path $root 'apps\server') `
  -commandLine 'node dist\main.js' `
  -outLog (Join-Path $logs 'server.out.log') `
  -errLog (Join-Path $logs 'server.err.log')

$webId = Start-Detached `
  -workingDirectory (Join-Path $root 'apps\web') `
  -commandLine 'node node_modules\vite\bin\vite.js --host 0.0.0.0' `
  -outLog (Join-Path $logs 'web.out.log') `
  -errLog (Join-Path $logs 'web.err.log')

Write-Log "api_pid=$apiId web_pid=$webId"
