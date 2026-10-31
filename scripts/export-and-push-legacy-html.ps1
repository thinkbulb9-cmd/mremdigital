# One-command campus extraction and GitHub upload of PUBLIC academic catalogue data.
# Existing database inventory determines which E: index.html files are read.
# No original HTML, E: source media, full paths, database secrets or student files are uploaded.
param([string]$SourceId='server1',[switch]$ExportOnly)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
$branch=(& git branch --show-current).Trim()
if($LASTEXITCODE -ne 0 -or $branch -ne 'main'){throw 'Run this only from the MREM main branch.'}
$remote=(& git remote get-url origin).Trim()
if($LASTEXITCODE -ne 0 -or $remote -notmatch '(^|[:/])thinkbulb9-cmd/mremdigital(\.git)?$'){
 throw 'Wrong GitHub origin. Refusing to upload.'
}
if(-not(Test-Path -LiteralPath '.env.local')){throw 'Missing .env.local. Do not upload database credentials.'}
Write-Host 'Reading legacy academic index.html files only; original E: files remain untouched.' -ForegroundColor Cyan
& npm run campus:html:extract -- $SourceId
if($LASTEXITCODE -ne 0){throw 'Extraction failed. Nothing was uploaded.'}
$summary=Get-Content -LiteralPath 'data\legacy-course-index\summary.json' -Raw | ConvertFrom-Json
if([int]$summary.distinct_course_ids -lt 1){throw 'No course metadata extracted; refusing upload.'}
Write-Host ('Found '+$summary.distinct_course_ids+' unique course IDs across '+$summary.index_files_opened+' HTML indexes.') -ForegroundColor Green
Write-Host 'PUBLIC repository warning: extracted course names, faculty names, disciplines and institutions will be visible on GitHub.' -ForegroundColor Yellow
Write-Host 'No video, PDF, original HTML, drive path, student records, password or .env file is included.' -ForegroundColor Yellow
if($ExportOnly){Write-Host 'Export only; nothing pushed. Output: data\legacy-course-index';exit 0}
& git add -- data/legacy-course-index
if($LASTEXITCODE -ne 0){throw 'Git staging failed'}
& git diff --cached --quiet -- data/legacy-course-index
if($LASTEXITCODE -eq 0){Write-Host 'No new academic catalogue changes to push.';exit 0}
if($LASTEXITCODE -ne 1){throw 'Git diff failed'}
& git commit --only -m 'Import sanitized MREM legacy HTML academic catalogue metadata' -- data/legacy-course-index
if($LASTEXITCODE -ne 0){throw 'Git commit failed; original data unaffected'}
& git push origin main
if($LASTEXITCODE -ne 0){throw 'GitHub push failed, likely authentication or remote changes. Export remains safe on Windows.'}
Write-Host 'SUCCESS: Sanitized academic catalogue published to GitHub main.' -ForegroundColor Green
Write-Host 'GitHub path: https://github.com/thinkbulb9-cmd/mremdigital/tree/main/data/legacy-course-index'
