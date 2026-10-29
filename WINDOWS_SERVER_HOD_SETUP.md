# MREM HOD Content Mapping: Windows Server Installation

This feature is designed for the college's **local Windows Server and LAN**, with PostgreSQL and original hard disks on-site. **No cloud service is required at runtime.** Test one or two small folders before considering the 90 TB archive.

## Installation prerequisites

- Windows Server 2019/2022 or another checked compatible 64-bit Windows Server
- Node.js 22+, PostgreSQL 16 or 17, Git
- PostgreSQL account with privileges to initialize the application schema and the pg_trgm extension
- Local NTFS folders or SMB UNC paths available **read-only** to the dedicated application service account
- Windows Task Scheduler and IIS reverse proxy with internal HTTPS for production

If the Windows Server is offline, download the trusted installers and npm dependencies through an approved installation process beforehand.

## 1. Install the application on the Windows Server

From PowerShell:

~~~powershell
git clone https://github.com/thinkbulb9-cmd/mremdigital.git C:\MREM\mremdigital
cd C:\MREM\mremdigital
npm install
Copy-Item .env.example .env.local
notepad .env.local
~~~

Configure DATABASE_URL to the PostgreSQL database that college IT created, as well as a unique LOGIN_PASSWORD and a SESSION_SECRET with at least 32 random characters. Never commit .env.local. Create a database called mrem_library (or update the connection URL to an alternative name). Initialize it:

~~~powershell
npm run db:init
npm run staff:setup -- bootstrap
~~~

The bootstrap prints a superadmin username and a **one-time generated password**. Save it privately; the application stores only a salted scrypt password hash.

## 2. Add first test disk(s) and scan

~~~powershell
npm run storage:add -- --id disk01 --name "First NPTEL Disk" --path "D:\NPTEL"
npm run scan -- disk01
npm run storage:add -- --id disk02 --name "Archive Disk" --path "E:\Archive"
npm run scan -- disk02
~~~

This registers metadata paths only. Media is not copied or uploaded. For stable server operations, use persistent drive mount points or authorized UNC paths. A Windows service identity may not have access to interactive user drive letters.

## 3. Create departments, courses and HOD accounts

~~~powershell
npm run staff:setup -- department CSE "Computer Science and Engineering"
npm run staff:setup -- department EEE "Electrical and Electronics Engineering"
npm run staff:setup -- department MECH "Mechanical Engineering"
npm run staff:setup -- course CSE DS "Data Structures"
npm run staff:setup -- course CSE DBMS "Database Management Systems"
npm run staff:setup -- course EEE CT "Circuit Theory"
npm run staff:setup -- user librarian librarian
npm run staff:setup -- user hodcse hod CSE
npm run staff:setup -- user hodeee hod EEE
npm run staff:setup -- grant hodcse disk01
npm run staff:setup -- grant hodcse disk02
npm run staff:setup -- grant hodeee disk01
~~~

Every created user receives a one-time generated password, displayed in the Windows Server terminal. Store these in the college's password manager and share them privately, never through GitHub or chat. HODs can only submit mappings for their department and for granted storage sources.

## 4. Open the staff application

~~~powershell
npm run build
npm run start
~~~

From the server itself open http://127.0.0.1:3000/staff/login. Sign in with the one-time staff credentials.

For other campus PCs, use an internally secured IIS HTTPS reverse proxy, for example https://library.mrem.local/staff/login, pointing at localhost:3000. Run the production app as a service under a non-admin account; do not use the development server in production. Keep the Node listening socket on loopback and do not forward internet traffic to it.

## 5. Workflow: HOD proposes, librarian approves

1. An HOD chooses an authorized disk and selects one raw folder or file.
2. They select their own department's course and submit a mapping proposal.
3. Librarian or Super Admin reviews pending requests and approves or rejects them.
4. Approved mappings are saved separately from the original disk files, then a batch indexing job is queued.
5. Run the assignment worker to update the searchable academic catalogue:

~~~powershell
npm run mappings:apply
~~~

6. Student catalogue and download API show only approved assigned files. Audit Trail records submissions, approvals, rejections and job completion.

One folder mapping can assign thousands of descendants. A specific file mapping wins over a folder mapping, and a deeper folder mapping wins over an outer folder. Files on multiple drives can have the same CSE and course category even when their original names and paths differ.

## 6. Schedule mapping updates

Create a Task Scheduler job every 5 to 10 minutes:

- Program: powershell.exe
- Arguments: -NoProfile -ExecutionPolicy Bypass -File "C:\MREM\mremdigital\scripts\windows-run-mappings.ps1"
- Start in: C:\MREM\mremdigital
- Identity: non-admin Windows service account permitted to connect to PostgreSQL

Scanning a disk again after changes also enqueues a metadata reconciliation job for already published mappings. Schedule disk scans during off-peak hours only after measuring indexing throughput on a sample disk.

## 7. Production hardening and limitations

- Staff account login and department-scoped mappings are separate from the older single-password **student pilot**. Per-student roll number activation and Excel student imports are NOT included in this change.
- Admin/HOD raw file exploration shows metadata. Student-facing files require approved assignments, and the download API checks publication.
- Staff sessions use HttpOnly cookies, account lockouts and server-side roles, but the IIS proxy still needs HTTPS, rate-limiting, logging, credential rotation and access controls.
- A granted storage source gives HODs visibility into raw file and folder metadata on that source, potentially including materials from other departments. Limit source grants accordingly or implement path-level grants before institution-wide rollout.
- The workflow has been type-checked in Vercel but has **not yet been integration-tested with the college's PostgreSQL database or Windows Server**.
- Indexing and database throughput for the full 90 TB, multi-user concurrency and backup/restore require validation. Do not scan all 90 TB on the first run.
- Confirm institutional licenses and permissions for NPTEL material before publishing it to student accounts.
