# MREM College Windows Server — Remaining Deployment and Review Workflow

Status at end of Oct 31, 2026: E: indexed 1,317,699 files / 45,043 folders.
One expected Windows-protected folder access warning (System Volume Information),
so latest scan was partial, not a fully verified scan. Do not alter permissions.

## Important: Do not lose the local Windows fixes
Previous hands-on edits were made directly on the college checkout:
- scripts/install-campus-server1.ps1 (Node version probe)
- app/api/campus/courses/route.ts (PostgreSQL text concatenation)
- components/CampusLibrary.tsx (PDF iframe in-app preview)

All three fixes are incorporated into the current GitHub main branch.
Before syncing on Windows, stop the Next.js server and back up/stash local edits.
From C:\MREM\mremdigital run:

    git stash push -m "MREM local pilot fixes before GitHub sync"
    git pull --ff-only origin main

The stash is intentionally kept for rollback. The .env.local file is git-ignored
and MUST NOT be copied to GitHub, pasted in chat, or included in screenshots.

## Update the on-prem catalogue (no new scan)
From an Administrator PowerShell in the project:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\finish-campus-pilot.ps1

This:
1. Updates the local PostgreSQL schema for publication approvals
2. Infers legacy NPTEL departments from the first 3 digits of course IDs,
   marking the result as suggested, NOT a verified course title
3. Produces summary and department audit output
4. Exports C:\MREM\inventory\course-hod-review.csv
5. Builds the local website again
6. Does not reindex E: and does not touch media bytes.

Run npm run start and browse http://127.0.0.1:3000/explore.
The first PDF iframe fix is preserved; alternative PDF workaround is not needed.

## Human-reviewed course titles
Open C:\MREM\inventory\course-hod-review.csv in Excel.
HOD/department staff must check verified titles and relevant departments.
For each verified row, fill all:
- reviewed_title (real course title, not Course 123456789)
- reviewed_department (MREM department, e.g. CSE / ECE / AI-ML)
- reviewed_by (identifiable college reviewer; no password)
- approve_title = YES

Save as CSV UTF-8. To import (titles only; not public access):

    npm run campus:review:import -- C:\MREM\inventory\course-hod-review.csv

No bulk guessing of titles. The 2019 legacy NPTEL subject-code mapping is only
a best-effort discipline suggestion and should not be labeled as HOD-verified.
NPTEL maps 106 to Computer Science, 108 to Electrical, 112 to Mechanical,
117 to Electronics and Communication; AI/ML does not have a distinct legacy
three-digit prefix in this mapping.

## Repeated PDF filenames are not necessarily duplicates
The UI groups files by semester and module. Different academic semesters may
contain separate copies of the same file name. Never delete, merge or hide files
solely because a filename repeats. The college can review metadata exports
and compare source, semester, size, hash (hash requires separately reading media)
before deciding on any deduplication.

Full inventory export when needed:

    npm run campus:export -- server1 C:\MREM\inventory

That detailed CSV can be large and may contain private names/paths. Keep on the
campus server; do not upload it publicly.

## Publication safety — REQUIRED before any college-wide student access
Local pilot listens only on 127.0.0.1. The legacy no-login view lists all indexed
course files by default, including Unclassified: do NOT place it on a LAN proxy.

Before LAN use:
1. College HOD/library staff review every file within each course to be published,
   including PDFs, ZIPs and unexpected file types.
2. For each approved course run (replace code and reviewer):

    npm run campus:publish -- --code 101101086 --reviewer "College Library HOD" --confirm

3. In .env.local set MREM_CAMPUS_REQUIRE_APPROVAL=enabled and save.
4. Restart website. Unapproved course codes will be excluded from listings,
   detail endpoints AND direct file-ID downloads. Unclassified files excluded.
5. Validate that unapproved file IDs return HTTP 404 / denied; test verified
   courses still play and download. Be mindful of publications that include
   non-course private files under the course ID path.
6. Arrange a restricted college-only IIS HTTPS reverse proxy plus firewall with
   campus IT; keep Node bound to 127.0.0.1.
7. Only after all those checks, have IT install a scheduled startup task/service
   using an unprivileged, dedicated Windows account with read-only E: permission.

To revoke:

    npm run campus:publish -- --code 101101086 --reviewer "College Library HOD" --revoke --confirm

WARNING: No login means no per-student access control. If department-only content,
auditing by student, or individual revocation is needed, implement student identity
checks instead of treating an unrestricted campus network as authorization.

## Windows auto-start (IT only, not yet activated)
A local-only startup wrapper exists: scripts/start-campus-local.ps1.
IT should create a Windows Scheduled Task at startup or an approved service
under a dedicated low-privilege account (not SYSTEM and not Administrator),
with working directory C:\MREM\mremdigital.
Use the wrapper script, enable retry on failure, service logs, and ensure the
local PostgreSQL service starts first.
Configure filesystem read permission to approved academic folders only, and
no write/delete permissions for source media. Configure database backups with
restore testing, a UPS, internal HTTPS, campus firewall, storage health alerts,
and capacity/concurrent playback testing.
No remote access/changes have been made to the college Windows Server through
the GitHub connector. All GitHub updates require an explicit git pull and local
rebuild on that machine.
