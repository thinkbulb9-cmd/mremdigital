# MREM Digital Learning Library — campus LMS and multi-drive operations

The college server runs one application and one set of scripts for every storage drive. A new drive is registered and
processed with the same commands as E:, F:, G: and H:; no drive-specific scanner or app is needed.

## Student access

- Students open the library address directly. There is no student login: `/` opens the LMS dashboard, `/login`
  redirects to it. Staff/HOD tools stay behind their own login at `/staff`.
- Campus mode (`MREM_CAMPUS_PUBLIC=enabled` in `.env.local`) serves the real catalogue. Without it the student pages show
  only a "not available" notice and file streaming is off.
- `npm start` listens on this server only (127.0.0.1). Nothing else on the network can reach it.

## Opening the library to the campus network

Publication is a college decision and opening the firewall changes the server's security settings, so each step below is
run by an authorised person on the server. Nothing here touches the archive drives.

1. **Turn approval on.** Add `MREM_CAMPUS_REQUIRE_APPROVAL=enabled` to `C:\MREM\mremdigital\.env.local`. From then on
   only approved courses (`campus_publications`) and approved folders (`campus_folder_publications`, for files without a
   course ID) are listed or streamed.
2. **Approve courses.** Preview first (writes `C:\MREM\inventory\unified\publish-preview.csv`, changes nothing):
   ```
   npm run campus:publish:bulk -- --verified-only
   npm run campus:publish:bulk -- --department "Computer Science and Engineering" --verified-only
   npm run campus:publish:bulk -- --codes C:\MREM\approved-course-ids.txt
   ```
   Then apply the same rule with `--reviewer "Name, role" --confirm`. Each row records the reviewer, time and rule.
   Undo with `--revoke`. One course at a time: `npm run campus:publish -- --code 106101001 --reviewer "..." --confirm`.
3. **Open the firewall for the campus subnet only** (Administrator PowerShell):
   ```
   powershell -ExecutionPolicy Bypass -File C:\MREM\mremdigital\scripts\open-campus-network.ps1 -Subnet 172.16.0.0/16
   ```
   It refuses while approval is off or nothing is approved, allows TCP 3000 from that subnet on Domain/Private networks
   only, and warns if the network is marked Public. PostgreSQL (5432) stays closed. Close again with `-Remove`.
4. **Start for the network:** `npm run build` then `npm run start:campus`. It also refuses to start while approval is
   off or nothing is approved. If Windows asks whether Node.js may communicate, choose **Cancel**: the rule from step 3
   is the only one needed, and the pop-up would open the port to every address.
5. **Test from another campus computer:** `http://172.16.0.160:3000/` (home, a department, a video, a web course, a PDF;
   an unapproved course ID must show "not found").

Staff sign-in over plain HTTP is unencrypted. Before staff use `/staff` from other computers, put HTTPS in front
(IIS with URL Rewrite/ARR, or Caddy) and keep the app itself on 127.0.0.1.

## Add a storage source (any drive letter, mount or share)

```
npm run storage:add -- --id server5 --name "MREM Archive 5" --path "I:/" --label MREM5
npm run campus:scan -- server5
npm run campus:legacy -- --source server5 --out C:/MREM/inventory/server5/html-audit --apply
npm run campus:departments
node --env-file=.env.local scripts/legacy-catalogue/apply-nptel-list.mjs --source server5 --list C:/MREM/inventory/nptel-courses-list.json.gz --out C:/MREM/inventory/server5/html-audit --apply
npm run nptel:fetch
npm run nptel:official-titles -- --apply
npm run nptel:reconcile -- --source server5 --out C:/MREM/inventory/server5/nptel-reconciliation --pdf C:/MREM/inventory/nptel-reconciliation/nptel-courses-pdf.json.gz
npm run nptel:lecture-titles -- --reports C:/MREM/inventory/server5/nptel-reconciliation --apply
npm run campus:reports
```

- `storage:add` records the volume serial. If Windows later gives the disk another letter, update `--path` for the same
  `--id`; a different disk at a registered path is refused until `--new-volume` is given on purpose.
- `npm run storage:check` reports every source as available, unavailable or identity_mismatch. An unavailable drive is
  skipped by the scanner and its records are kept; other drives are never affected.
- Scans are idempotent (re-running updates the same rows) and skip Windows system folders at the volume root.
- Course titles follow the verification order: local HTML catalogue, NPTEL Courses PDF, official nptel.ac.in catalogue.
  A verified or staff-reviewed title is never replaced. Course IDs without a verified title are shown by course ID.
- Lecture titles are shown only when tied to the exact file: a local catalogue link, the official download list naming
  the same file (HIGH), or staff review. MEDIUM matches (module and lecture numbers only) are stored for review only.

## Reports

`npm run campus:reports` writes, outside the media drives:

- `C:\MREM\inventory\<source>\course-inventory.csv`, `html-index-mapping.csv`, `content-availability.csv`,
  `mapping-conflicts.csv`, `processing-summary.json`
- `C:\MREM\inventory\unified\all-course-catalogue.csv`, `course-offerings.csv`, `verified-lesson-mappings.csv`,
  `unresolved-metadata.csv`, `drive-coverage-summary.json`

These contain archive paths: keep them on the server, never commit them.

## Build and restart

```
npm run db:init        # adds new tables/columns only (back up first: pg_dump -Fc)
npm run build
npm start              # next start -H 127.0.0.1 (port 3000)
```

## Rollback

- Code: check out the previous branch/commit and rebuild.
- Course titles: each fill keeps a backup table (`nptel_list_backup_*`, `official_titles_backup_*`, `dept_merge_backup_*`).
- Lecture titles: `DELETE FROM lecture_titles WHERE source='nptel-reconciliation'`.
- Database: restore the `pg_dump` taken before the change (`C:\MREM\inventory\db-backups`).
