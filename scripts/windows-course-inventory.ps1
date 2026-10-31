# Read-only metadata inventory for one MREM Windows folder.
# Usage:
# powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-course-inventory.ps1 -RootPath "E:\Jan_Apr_2021\101" -OutputFolder "C:\MREM\inventory"
# Never edits, renames, copies, deletes or opens media files on the source drive.
param(
 [Parameter(Mandatory=$true)][string]$RootPath,
 [string]$OutputFolder="C:\MREM\inventory",
 [int]$MaxFiles=30000,
 [int]$MaxDirectories=5000
)
$ErrorActionPreference='Stop'
if($MaxFiles -lt 1 -or $MaxFiles -gt 1000000){throw 'MaxFiles must be between 1 and 1,000,000'}
if($MaxDirectories -lt 1 -or $MaxDirectories -gt 200000){throw 'MaxDirectories must be between 1 and 200,000'}
$resolved=(Resolve-Path -LiteralPath $RootPath).ProviderPath.TrimEnd('\')
if(-not (Test-Path -LiteralPath $resolved -PathType Container)){throw 'RootPath must be an accessible directory'}
$dest=[System.IO.Path]::GetFullPath($OutputFolder).TrimEnd('\')
if($dest.Equals($resolved,[StringComparison]::OrdinalIgnoreCase) -or
   $dest.StartsWith($resolved+'\',[StringComparison]::OrdinalIgnoreCase)){
 throw 'OutputFolder must be OUTSIDE the selected source drive folder'
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$csvPath=Join-Path $dest 'mrem-files.csv'
$coursePath=Join-Path $dest 'mrem-course-summary.csv'
$errorPath=Join-Path $dest 'mrem-scan-errors.txt'
$encoding=New-Object System.Text.UTF8Encoding($false)
$writer=New-Object System.IO.StreamWriter($csvPath,$false,$encoding)
$writer.WriteLine('"RelativePath","CourseId","Semester","Module","Lecture","FileName","Extension","Type","SizeBytes","ModifiedUtc"')
$errors=New-Object 'System.Collections.Generic.List[string]'
$summary=@{}
$stack=New-Object 'System.Collections.Generic.Stack[string]'
$stack.Push($resolved)
$fileCount=0
$folderCount=0
$truncated=$false
function Csv([object]$value){
 if($null -eq $value){return '""'}
 return '"'+([string]$value).Replace('"','""')+'"'
}
try{
 while($stack.Count -gt 0){
  if($folderCount -ge $MaxDirectories -or $fileCount -ge $MaxFiles){$truncated=$true;break}
  $folder=$stack.Pop()
  $folderCount++
  try{$entries=Get-ChildItem -LiteralPath $folder -Force -ErrorAction Stop}
  catch{$errors.Add(("Cannot enumerate: "+$folder+": "+$_.Exception.Message));continue}
  foreach($item in $entries){
   if($fileCount -ge $MaxFiles){$truncated=$true;break}
   if(($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0){continue}
   if($item.PSIsContainer){$stack.Push($item.FullName);continue}
   $fileCount++
   $relative=$item.FullName.Substring($resolved.Length).TrimStart('\').Replace('\','/')
   $courseId=''
   foreach($segment in ($relative -split '/')){
    if($segment -match '^[0-9]{9}$'){$courseId=$segment;break}
   }
   $semester=''
   if($item.FullName -match '(Jan[_-]Apr[_-]\d{4}|Jul[_-]Dec[_-]\d{4}|Web_courses)'){$semester=$matches[1]}
   $module='';$lecture=''
   if($item.BaseName -match '(?i)mod0*(\d+)lec0*(\d+)'){$module=$matches[1];$lecture=$matches[2]}
   $ext=$item.Extension.ToLowerInvariant()
   $kind=if(@('.mp4','.m4v','.webm','.mov','.avi','.mkv') -contains $ext){'Video'}
         elseif(@('.pdf','.txt','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.csv') -contains $ext){'Document'}
         elseif(@('.html','.htm') -contains $ext){'HTML'}
         elseif(@('.jpg','.jpeg','.png','.webp') -contains $ext){'Image'}
         else{'Other'}
   $fields=@($relative,$courseId,$semester,$module,$lecture,$item.Name,$ext,$kind,$item.Length,$item.LastWriteTimeUtc.ToString('o'))
   $writer.WriteLine(($fields | ForEach-Object {Csv $_}) -join ',')
   $key=$semester+'|'+$courseId
   if(-not $summary.ContainsKey($key)){$summary[$key]=[PSCustomObject]@{Semester=$semester;CourseId=$courseId;TotalFiles=0;Videos=0;Documents=0;HTML=0;Other=0}}
   $row=$summary[$key];$row.TotalFiles++
   if($kind -eq 'Video'){$row.Videos++}
   elseif($kind -eq 'Document'){$row.Documents++}
   elseif($kind -eq 'HTML'){$row.HTML++}
   else{$row.Other++}
   if($fileCount%5000 -eq 0){Write-Host ("Scanned "+$fileCount+" files; "+$folderCount+" folders")}
  }
 }
}finally{$writer.Dispose()}
$summary.Values | Sort-Object Semester,CourseId | Export-Csv -Path $coursePath -NoTypeInformation -Encoding UTF8
$errors | Out-File -FilePath $errorPath -Encoding UTF8
Write-Host "Inventory completed; metadata only. Source files untouched."
Write-Host ("Files scanned: "+$fileCount+" | Directories scanned: "+$folderCount)
Write-Host ("Truncated by safety limits: "+$truncated)
Write-Host ("File metadata CSV: "+$csvPath)
Write-Host ("Course summary CSV: "+$coursePath)
Write-Host ("Inaccessible paths/errors: "+$errorPath)
