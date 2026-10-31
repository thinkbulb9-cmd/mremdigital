# MREM campus server1 installation. Windows PowerShell, run from the repo.
# PostgreSQL database must already exist. Run once to create .env.local and fill DATABASE_URL.
param([string]$DrivePath='E:\',[string]$SourceId='server1',[switch]$SkipScan)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
foreach($app in @('node','npm','git')){
 if(-not(Get-Command $app -ErrorAction SilentlyContinue)){throw "Install missing prerequisite: $app"}
}
$major=[int]((& node -p 'process.versions.node.split(".")[0]').Trim())
if($major -lt 22){throw 'Node.js 22+ required'}
if(-not(Test-Path -LiteralPath $DrivePath -PathType Container)){throw "Drive not accessible: $DrivePath"}
$envFile=Join-Path $Root '.env.local'
if(-not(Test-Path -LiteralPath $envFile)){
 Copy-Item -LiteralPath (Join-Path $Root '.env.example') -Destination $envFile
 Add-Content -LiteralPath $envFile -Value 'MREM_CAMPUS_PUBLIC=enabled'
 Write-Host 'Created .env.local. Configure DATABASE_URL for your local PostgreSQL database.' -ForegroundColor Yellow
 & notepad.exe $envFile
 throw 'Save database credentials and rerun this installation script.'
}
$contents=[IO.File]::ReadAllText($envFile)
if($contents -notmatch '(?m)^DATABASE_URL=postgres(?:ql)?://' -or $contents -match 'mrem_local_only@'){
 & notepad.exe $envFile
 throw 'Configure DATABASE_URL with the real local database login first.'
}
if($contents -match '(?m)^MREM_CAMPUS_PUBLIC='){
 $contents=[regex]::Replace($contents,'(?m)^MREM_CAMPUS_PUBLIC=.*$','MREM_CAMPUS_PUBLIC=enabled')
}else{
 $contents+=[Environment]::NewLine+'MREM_CAMPUS_PUBLIC=enabled'+[Environment]::NewLine
}
$sessionKey=& node -e 'process.stdout.write(require("node:crypto").randomBytes(48).toString("hex"))'
$loginKey=& node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))'
$contents=[regex]::Replace($contents,'(?m)^SESSION_SECRET=CHANGE_TO_RANDOM_64_CHAR_SESSION_SECRET$',"SESSION_SECRET=$sessionKey")
$contents=[regex]::Replace($contents,'(?m)^LOGIN_PASSWORD=CHANGE_TO_LONG_UNIQUE_TEST_PASSWORD$',"LOGIN_PASSWORD=$loginKey")
[IO.File]::WriteAllText($envFile,$contents,(New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Installing dependencies...'
& npm install
if($LASTEXITCODE -ne 0){throw 'npm install failed'}
& npm run db:init
if($LASTEXITCODE -ne 0){throw 'PostgreSQL setup failed'}
& npm run campus:metadata -- data/verified-course-metadata.json
if($LASTEXITCODE -ne 0){throw 'Metadata import failed'}
& npm run storage:add -- --id $SourceId --name 'College Course Archive' --path $DrivePath
if($LASTEXITCODE -ne 0){throw 'Drive registration failed'}
& npm run build
if($LASTEXITCODE -ne 0){throw 'Next.js build failed'}
if(-not $SkipScan){
 $scanScript=Join-Path $Root 'scripts\run-server1-scan.ps1'
 Write-Host 'Opening a separate local scanner window for the ENTIRE registered drive.'
 $arguments='-NoProfile -NoExit -ExecutionPolicy Bypass -File "'+$scanScript+'" -SourceId '+$SourceId
 Start-Process -FilePath 'powershell.exe' -WorkingDirectory $Root -ArgumentList $arguments | Out-Null
}
Write-Host 'College LMS: http://127.0.0.1:3000' -ForegroundColor Green
Write-Host 'LAN PCs require a college-IT-controlled HTTPS reverse proxy. Do not expose this anonymous service to the internet.'
& npm run start
