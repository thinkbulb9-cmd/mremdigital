# MREM Server 1 — Full Windows E: Drive Installation

This is an on-premises college installation. The entire registered MREM1 E: drive is indexed; NOT just the Jan-Apr 2021 / 101 folder.

Prerequisites: Windows Server with Node.js 22+, npm, Git and local PostgreSQL 16/17. Create a dedicated PostgreSQL database and application user before starting. Source media remains on E: and is never copied, moved, deleted or uploaded.

## Windows PowerShell

Clone (requires GitHub and npm access during installation):

    git clone https://github.com/thinkbulb9-cmd/mremdigital.git C:\MREM\mremdigital
    cd C:\MREM\mremdigital
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-campus-server1.ps1 -DrivePath "E:\" -SourceId server1

The first run creates .env.local, opens Notepad and stops. Replace DATABASE_URL with the dedicated LOCAL PostgreSQL connection details, save, and rerun the same install command. Do not share the database password in chat.

The next run:
1) installs npm dependencies
2) initializes the catalogue schema
3) imports the shipped verified NPTEL course titles (three IDs to start)
4) registers the ENTIRE E: drive as server1
5) builds the offline student website
6) starts a read-only whole-drive metadata scan in a second PowerShell window
7) starts the student app at http://127.0.0.1:3000

Initially the index may be empty; new courses appear as rows are indexed. A full drive can take substantial time. No limits on number of files/folders, but scan speeds and available permissions can affect completeness. If some folders cannot be read, the scan is marked partial instead of deleting previously indexed data.

For an already cloned checkout:

    cd C:\MREM\mremdigital
    git pull origin main
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-campus-server1.ps1 -DrivePath "E:\" -SourceId server1

## Obtain the complete metadata mapping report

After the scan, from another PowerShell window in the repo:

    npm run campus:export -- server1 C:\MREM\inventory

This produces a course-summary CSV and a full per-file CSV with source ID, relative path, course ID, semester, module and lecture numbers, filename, extension and size. NO source videos, documents or media bytes are exported. The local CSV itself may be large and can contain personal text in filenames: have college IT review it before sharing.

Metadata updates can be imported from a reviewed JSON file:

    npm run campus:metadata -- C:\MREM\reviewed-catalog.json

A course entry has course_code, title, department, verified and optional instructor/institution. It can additionally contain lectures with module_no, lecture_no, title, verified. Unverified titles are not shown as official lecture names.

## Student browsing

No student login in the on-prem campus configuration. It automatically displays all indexed approved file types (subject to LAN network policy), including UNCLASSIFIED records that have no numeric course ID. Course title/name matching is independent of the physical folders. Play MP4, preview PDF/TXT/images and safe HTML source, download permitted original files. Student screens reveal no drive letters, server IDs, raw path data or external NPTEL links.

## Add remaining drives

    npm run storage:add -- --id server2 --name "College Archive 2" --path "F:\"
    npm run campus:scan -- server2

Same mechanism for server3 and server4. Their contents merge under the same Course ID in the student LMS.

## Deployment safety and checks

The Next.js production server runs on 127.0.0.1:3000. This initial script starts it in the current terminal, NOT as a Windows service. College IT must configure an approved Windows service, campus-only IIS HTTPS reverse proxy and firewall before general student use. Do not expose an anonymous download server to the public internet.

This is a GitHub implementation, NOT proof that the actual E: drive has been scanned. Test actual video playback and HTTP range seeking, PDF download, PostgreSQL performance, disk permissions, restart behavior, backup/restore, and concurrency on Windows before opening to all students. No cloud server is required after local installation.
