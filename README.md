# MREM Digital Learning Library

The learning library of **Malla Reddy Engineering College and Management Sciences (MREM)**, an UGC Autonomous Institution.
It runs on the college Windows Server, reads the NPTEL course archive on the server's storage drives (E:, F:, G:, H: and any
drive added later) and presents it to students as one library: departments, video courses, web courses and study materials.
Students need no login. Original archive files are never changed.

## Student application

Full-width pages with a top navigation bar (no sidebar). Every page has its own URL, so Back/Forward, refresh and links work.

| Route | Page |
|---|---|
| `/` | Home: MREM announcements, library statistics, departments, video courses, web courses, study materials |
| `/departments`, `/departments/[department]` | Department directory and a department's courses |
| `/courses`, `/courses/[courseId]` | Course catalogue (search and filters) and a course overview with its offerings and resources |
| `/courses/[courseId]/lessons/[resourceId]` | One lecture, PDF, document or page in the full-width viewer, with Previous / Next |
| `/video-courses` | Courses with video lectures |
| `/web-courses`, `/web-courses/[department]`, `/web-courses/[department]/[courseId]` | NPTEL web courses by department; a web course opens on its start page |
| `/web-courses/[department]/[courseId]/pages/[resourceId]` | One page of a web course |
| `/study-materials` | PDFs and documents from course folders |
| `/staff` | Staff/HOD tools (separate login) |

Viewers: MP4 with seeking (HTTP range requests), PDF in the browser viewer, legacy HTML rebuilt as a static page (no scripts,
frames, forms or event handlers; links and images resolved to library files) and served with `Content-Security-Policy: sandbox`,
text, images; other files show their details and a download where permitted.

### What the statistics count

- **Courses**: unique course IDs with files available to students. A course held on several drives or semesters counts once.
- **Video courses**: courses with at least one video. **Web courses**: courses NPTEL lists as web courses that have HTML pages.
- **Video lectures, PDF resources, text and documents**: files inside course folders (a lecture copied on two drives counts twice).
- **Departments**: NPTEL disciplines that have at least one course. Files without a course ID are not counted or shown.

### Titles

Course titles come from, in order: the local HTML catalogue in the archive, the NPTEL Courses PDF, the official nptel.ac.in
catalogue. A course without a verified title is shown by its course ID. A lecture title is shown only when it is tied to that
exact file (the local catalogue links it, or the official NPTEL lecture list names the same file, or staff reviewed it);
otherwise the original file name is shown. Nothing is guessed from a course name or list position.

## Data pipeline (same commands for every drive)

```
npm run storage:add -- --id server5 --name "MREM Archive 5" --path "I:/" --label MREM5   # records the volume serial
npm run campus:scan -- server5                                                          # read-only, idempotent index
npm run campus:legacy -- --source server5 --out C:/MREM/inventory/server5/html-audit --apply
npm run campus:departments
node --env-file=.env.local scripts/legacy-catalogue/apply-nptel-list.mjs --source server5 --list C:/MREM/inventory/nptel-courses-list.json.gz --out C:/MREM/inventory/server5/html-audit --apply
npm run nptel:fetch && npm run nptel:official-titles -- --apply
node --env-file=.env.local scripts/nptel-reconciliation/apply-content-types.mjs --pdf C:/MREM/inventory/nptel-reconciliation/nptel-courses-pdf.json.gz --apply
npm run nptel:reconcile -- --source server5 --out C:/MREM/inventory/server5/nptel-reconciliation --pdf C:/MREM/inventory/nptel-reconciliation/nptel-courses-pdf.json.gz
npm run nptel:lecture-titles -- --reports C:/MREM/inventory/server5/nptel-reconciliation --apply
npm run campus:reports
```

Details, approvals, reports and rollback: [CAMPUS_LMS_FOUR_DRIVES.md](CAMPUS_LMS_FOUR_DRIVES.md). Windows installation:
[CAMPUS_SERVER1_WINDOWS_INSTALL.md](CAMPUS_SERVER1_WINDOWS_INSTALL.md).

## Configuration (`.env.local`, never committed)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL `mrem_library` |
| `MREM_CAMPUS_PUBLIC=enabled` | Serve the catalogue (college server only) |
| `MREM_CAMPUS_REQUIRE_APPROVAL=enabled` | Show only college-approved courses/folders. **Required before campus-network access** (`npm run start:campus` refuses without it). |
| `MREM_CATALOG_CACHE_SECONDS` | Catalogue cache (default 300) |
| `SESSION_SECRET` | Staff sessions (32+ random characters) |

## Build, test, run

```
npm install
npm run db:init                       # creates/updates tables (back up first with pg_dump -Fc)
npm run typecheck && npm run test:nptel && npm run test:legacy && npm run test:stream
npm run build && npm start            # this server only (127.0.0.1:3000)
npm run start:campus                  # campus network: needs approval on and approved courses
```

Approving courses (`npm run campus:publish:bulk`) and opening the campus network (`scripts/open-campus-network.ps1`):
see [CAMPUS_LMS_FOUR_DRIVES.md](CAMPUS_LMS_FOUR_DRIVES.md#opening-the-library-to-the-campus-network).

## Code map

- `app/(student)/` student pages and design system (`lms.css`); `components/lms/` header, banner, viewer, cards
- `app/api/files/[id]/download` file streaming with the visibility rule, range support and safe HTML
- `lib/campus-catalog.ts` catalogue queries, statistics and the single visibility rule; `lib/safe-html.ts` HTML rebuilding
- `scripts/` indexing (`scan-full-drive`, `register-storage`, `storage-check`), metadata (`legacy-catalogue/`,
  `nptel-reconciliation/`), department artwork generator (`design/department-art.mjs`)
- `sql/` schema; `public/brand` official MREM emblem (from mrem.ac.in); `public/art`, `public/lms-art` original illustrations

## Known limitations

- Departments are NPTEL disciplines; MREM-specific departments (for example CSE AI & ML) need a staff-approved mapping.
- Courses that no local catalogue, PDF or nptel.ac.in names are shown by course ID.
- Lecture titles exist only where evidence ties them to the exact file; many lectures show their original file names.
- College publication approval must be switched on and courses approved before the library is opened to the campus network.
- Plain HTTP: put an HTTPS reverse proxy in front before staff sign in from other computers.
