# Runs the approved mapping worker on a Windows Server (no cloud access required).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
& node --env-file=.env.local scripts/apply-mappings.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
