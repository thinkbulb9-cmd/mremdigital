<#
 Opens the MREM Digital Learning Library to the college network. Run in an Administrator PowerShell on the server:
   powershell -ExecutionPolicy Bypass -File C:\MREM\mremdigital\scripts\open-campus-network.ps1 -Subnet 172.16.0.0/16
 Close it again:
   powershell -ExecutionPolicy Bypass -File C:\MREM\mremdigital\scripts\open-campus-network.ps1 -Remove
 Refuses to open while college approval is off or no course is approved, so unapproved material is never reachable.
 Allows only the given campus subnet to reach the app port; PostgreSQL and the storage drives are not opened.
#>
param([string]$Subnet='',[int]$Port=3000,[switch]$Remove)
$ErrorActionPreference='Stop'
$rule='MREM Digital Learning Library (campus network)'
$app='C:\MREM\mremdigital'
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  throw 'Run this in an Administrator PowerShell.'
}
if($Remove){
  Get-NetFirewallRule -DisplayName $rule -EA SilentlyContinue | Remove-NetFirewallRule
  Write-Host "Removed firewall rule '$rule'. Restart the app with 'npm start' to listen on this server only." -ForegroundColor Yellow
  return
}
if($Subnet -notmatch '^\d{1,3}(\.\d{1,3}){3}/\d{1,2}$'){throw 'Give the campus subnet, for example -Subnet 172.16.0.0/16'}
$envFile=Join-Path $app '.env.local'
if(-not (Select-String -Path $envFile -Pattern '^MREM_CAMPUS_REQUIRE_APPROVAL=enabled\s*$' -Quiet)){
  throw "College approval is off. Add MREM_CAMPUS_REQUIRE_APPROVAL=enabled to $envFile, approve courses (npm run campus:publish:bulk), then run this again."
}
Push-Location $app
try{
  $approved=(node --env-file=.env.local -e "const pg=require('pg');const c=new pg.Client({connectionString:process.env.DATABASE_URL});c.connect().then(async()=>{const r=await c.query('SELECT count(*)::int n FROM campus_publications WHERE approved');console.log(r.rows[0].n);await c.end()})") | Select-Object -Last 1
}finally{Pop-Location}
if([int]$approved -lt 1){throw 'No course is approved yet. Approve courses with npm run campus:publish:bulk before opening the library.'}
$existing=Get-NetFirewallRule -DisplayName $rule -EA SilentlyContinue
if($existing){$existing | Remove-NetFirewallRule}
New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $Port -RemoteAddress $Subnet -Profile Domain,Private -Action Allow | Out-Null
$profiles=Get-NetConnectionProfile | Select-Object InterfaceAlias,NetworkCategory
$ips=(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)\.' }).IPAddress
Write-Host "Firewall rule '$rule': TCP $Port allowed from $Subnet (Domain/Private networks). $approved approved courses." -ForegroundColor Green
$profiles | Format-Table -AutoSize
if($profiles.NetworkCategory -contains 'Public'){Write-Host 'Warning: a network is set to Public, where this rule does not apply. Ask IT to set the campus network to Private or Domain.' -ForegroundColor Yellow}
Write-Host "Restart the app so it listens on the network:  cd $app ; npm run build ; npm run start:campus"
Write-Host 'If Windows asks whether Node.js may communicate, choose Cancel: this rule is the only one needed.' -ForegroundColor Yellow
foreach($ip in $ips){Write-Host "Then open from another campus computer:  http://${ip}:$Port/"}
Write-Host 'Staff sign-in travels unencrypted over plain HTTP; put HTTPS (IIS or Caddy reverse proxy) in front before staff use it over the network.'
