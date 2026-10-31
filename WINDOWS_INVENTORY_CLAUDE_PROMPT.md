# MREM course inventory handoff to Claude Code (Windows Server)
 
## Goal
Discover local file/folder **metadata only** so the MREM student LMS can show course → module → lecture → Play/View/Download without external course links, student login or storage details on the student page. The first pilot uses `MREM1 (E:)`. Subsequent registered storage sources can be named internally `server1`, `server2`, `server3`, `server4`, but their Windows paths must never be shown in student pages.

## Claude Code prompt

> You are the authorized local inventory assistant for the MREM Digital Library project at `C:\MREM\mremdigital` on the college Windows Server. This is an OFFLINE / ON-PREMISES application. You may inspect file metadata and small HTML/Excel course indexes inside the explicitly approved root paths, but DO NOT move, rename, modify, delete, hash, copy, upload or transcode any college lecture videos. DO NOT change Windows permissions, remote desktop/AnyDesk settings, or install remote agents. Never read or export credentials, private student records or unrelated files.
>
> First perform a bounded read-only inventory on `E:\Jan_Apr_2021\101` (not all 90 TB) with the repository's `scripts/windows-course-inventory.ps1`. Output metadata CSVs outside E:, e.g. `C:\MREM\inventory`. Do not traverse junctions/reparse points. Include source alias, semester, the 9-digit course identifier, module and lecture numbers parsed from `modXXlecYY.mp4`, file extension, size, and relative path. Record inaccessible folders separately and indicate if scanning stopped at the safety cap.
>
> Identify any `index.html`, `displayvideo.html`, `displayweb.html`, `list.xls`, `list.xlsx` or `list1.xlsx` files in scope. If authorized, inspect only small index/metadata files (up to a modest size limit) as inert text or spreadsheet values: DO NOT execute HTML scripts, follow remote links, or open videos. Report candidate course names, week/module headings and lecture titles with provenance.
>
> Produce: (1) `mrem-course-summary.csv`, (2) `mrem-files.csv`, (3) `mrem-course-map.json` with proposed `course_id -> title, department, source semester, confidence, evidence`, (4) `mrem-lecture-map.json` with `course_id + module + lecture -> exact relative media path + candidate title + title source + confidence`, and (5) `mrem-unmatched.csv` for files whose course/topic cannot be verified. Every file path must be LOCAL and relative to the registered source. Do not invent missing titles or assume module numbers equal week numbers; compare any external course outlines only offline from previously supplied approved reference data. Unknown or ambiguous titles must be clearly marked "needs review".
>
> Keep original files untouched. Changes to the MREM Next.js app should be suggested only after the inventory is reviewed. Never paste credentials or personal data into output.

## Run the initial one-folder inventory

Open PowerShell in `C:\MREM\mremdigital`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-course-inventory.ps1 -RootPath "E:\Jan_Apr_2021\101" -OutputFolder "C:\MREM\inventory" -MaxFiles 30000 -MaxDirectories 5000
```

Review the generated CSV to ensure it contains no personal data before sharing it back for catalogue mapping. The scanner captures file names and paths, which sometimes contain sensitive information.

## Why metadata only
Video files remain on the source volume. A 30,000-file catalogue scan reads only filesystem directory entries; it does not upload TBs of content. This first pass is designed to establish accuracy and performance before you consider scanning other semesters or all registered drives.
