# Legacy NPTEL HTML catalogue mapping on the college Windows Server.
# Reads catalogue pages from E: (never writes there); media is never opened. Reports go to C:\MREM\inventory\html-audit.
#   Pilot dry run:  .\scripts\windows-legacy-catalogue.ps1 -Mode Pilot
#   Full dry run:   .\scripts\windows-legacy-catalogue.ps1 -Mode DryRun
#   Import:         .\scripts\windows-legacy-catalogue.ps1 -Mode Apply
param(
 [ValidateSet('Pilot','DryRun','Apply')][string]$Mode='Pilot',
 [string[]]$PilotScope=@('Jan_Apr_2021/101'),
 [string]$SourceId='server1',
 [string]$OutDir='C:\MREM\inventory\html-audit'
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
if(-not(Test-Path -LiteralPath (Join-Path $Root '.env.local'))) {throw 'Missing .env.local. Preserve the existing database connection and secrets.'}
function Run([string[]]$Arguments){
 Write-Host ('> '+($Arguments -join ' ')) -ForegroundColor Cyan
 & $Arguments[0] $Arguments[1..($Arguments.Length-1)]
 if($LASTEXITCODE -ne 0){throw 'Command failed. Stop and review the error; archive files are unchanged.'}
}
Run @('npm','run','db:init')
Run @('npm','run','test:legacy')
$cmd=@('node','--env-file=.env.local','scripts/legacy-catalogue/run.mjs','--source',$SourceId,'--out',$OutDir)
if($Mode -eq 'Pilot'){ foreach($p in $PilotScope){ $cmd+=@('--pilot',$p) } }
if($Mode -eq 'Apply'){ $cmd+='--apply' }
Run $cmd
Write-Host ("Reports: "+$OutDir+"\mapping_coverage_summary.json and CSV files.") -ForegroundColor Green
if($Mode -ne 'Apply'){ Write-Host 'Dry run only. Review missing_conflicting_metadata.csv and master_course_catalogue.csv, then run with -Mode Apply.' -ForegroundColor Yellow }
else { Write-Host 'Imported. Rebuild and restart the app: npm run build, then npm run start.' -ForegroundColor Yellow }
