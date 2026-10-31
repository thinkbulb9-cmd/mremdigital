# Complete local MREM campus pilot without re-scanning E: or editing media.
# Run ONLY after syncing the repository to the latest code.
$ErrorActionPreference = 'Stop'
$Root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
if(-not(Test-Path -LiteralPath (Join-Path $Root '.env.local'))) {throw 'Missing .env.local. Preserve the existing database connection and secrets.'}
function Run-Npm([string[]]$Arguments){
 Write-Host ('> npm '+($Arguments -join ' ')) -ForegroundColor Cyan
 & npm @Arguments
 if($LASTEXITCODE -ne 0){throw 'npm command failed. Stop and review the error; original files are unchanged.'}
}
Run-Npm -Arguments @('run','db:init')
Run-Npm -Arguments @('run','campus:departments')
Run-Npm -Arguments @('run','campus:audit','--','server1')
Run-Npm -Arguments @('run','campus:review:export','--','C:\MREM\inventory')
Run-Npm -Arguments @('run','campus:repeats','--','server1','C:\MREM\inventory')
Run-Npm -Arguments @('run','build')
Write-Host 'LOCAL PILOT READY. Start with npm run start, then open http://127.0.0.1:3000/explore' -ForegroundColor Green
Write-Host 'No scan was launched. Media on E: untouched. Do NOT expose to LAN before approval workflow and campus IT configuration.' -ForegroundColor Yellow
