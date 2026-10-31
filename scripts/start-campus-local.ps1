# Startup wrapper for college IT (schedule only after content approvals).
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
if(-not(Test-Path -LiteralPath (Join-Path $Root '.env.local'))) {throw 'Missing campus environment file'}
$node=Get-Command node.exe -ErrorAction Stop
$next=Join-Path $Root 'node_modules\next\dist\bin\next'
if(-not(Test-Path -LiteralPath $next)){throw 'Run npm install and npm run build first'}
& $node.Source $next start -H 127.0.0.1 -p 3000
if($LASTEXITCODE -ne 0){throw 'Campus web server exited with error code '+$LASTEXITCODE}
