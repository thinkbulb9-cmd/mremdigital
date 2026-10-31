param([string]$SourceId='server1')
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
Write-Host "Scanning complete metadata of registered source: $SourceId. Videos are not opened, copied or moved."
& npm run campus:scan -- $SourceId
if($LASTEXITCODE -ne 0){throw 'Full drive metadata scan failed; see error above'}
