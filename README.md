# MREM Digital Library — Custom Next.js + PostgreSQL pilot

**Status:** Working-source architecture and local pilot starter, **not a tested production application**.

A small digital library for **Malla Reddy Engineering College and Management Sciences**. Maps existing hard-disk folders to a searchable academic web portal **without moving, renaming, uploading or duplicating original files**.

## Pilot functions included

- Next.js 16 App Router, React/TypeScript responsive student UI.
- Password-protected *single-user pilot session*. This is not college SSO or production RBAC.
- Local or SMB-mounted directory registration with logical disk IDs (terminal command only).
- Read-only, recursive metadata worker with missing-files reconciliation only on successful scans.
- PostgreSQL catalogue, filename search and branch/course filters derived from path hierarchy.
- Authenticated file downloads and browser PDF/video viewing, including single HTTP byte ranges.
- Storage overview and scan history admin display (read-only dashboard).
- Safe synthetic sample files; original content not supplied and never bundled.

## Prerequisites

1. Node.js **22 or newer** (tested only for syntax here, not functional execution). `node --version`
2. Docker Desktop, or a locally installed PostgreSQL 17 database (edit `DATABASE_URL` if not Docker).
3. Windows or Linux computer with **read-only access** to the storage folder(s).
4. All commands below run on the computer that can access the disks, **not on Vercel**.

### Quick start (Windows PowerShell or Linux shell)

```bash
cd mrem-nextjs-starter
# Copy .env.example to .env.local; edit LOGIN_PASSWORD and SESSION_SECRET to strong random values.
# PowerShell: Copy-Item .env.example .env.local
# macOS/Linux: cp .env.example .env.local
npm install
docker compose up -d
npm run db:init
npm run seed:demo
npm run scan
npm run dev
```

Open http://localhost:3000 and enter **your `LOGIN_PASSWORD`** from `.env.local`.

The local demonstration generates FIVE synthetic `.txt` files in `local-demo-storage` and indexes them.

### Connect one real read-only folder (after the demonstration)

Example Windows, where `E:\\NPTEL` exists on the server:

```powershell
npm run storage:add -- --id nptel01 --name "NPTEL Disk One" --path "E:\NPTEL"
npm run scan -- nptel01
```

Example Linux:

```bash
npm run storage:add -- --id nptel01 --name "NPTEL Disk One" --path /mnt/nptel/disk01
npm run scan -- nptel01
```

**On Windows:** For dependable server operation, use stable NTFS volume mount points or accessible UNC shares rather than changeable USB drive letters; run the service and scanner under an account that has access to the directories. Use read-only NTFS/share permissions. A mere read-only app convention is not enough to protect source data.

### Preview and download

- Sign in and use the main browser to search/filter.
- Each resource has a `Download` control; supported text/PDF/video files expose a Preview control.
- The downloader looks up the file by a database ID, verifies the user session, resolves the realpath within the registered root, then streams the original file.
- A newly added file is not immediately visible until you run the worker again. Add a scheduled scan only after verifying the pilot, ideally with file watcher + periodic reconciliation.

### Data mapping assumptions for the pilot

```
Disk01/
  Aerospace Engineering/
    Aerodynamics/
      Lecture01.mp4
      Notes.pdf
  Mechanical Engineering/
    Thermodynamics/
      Lecture02.mp4
```

Directory level 1 is used as the department, level 2 as the course, and subsequent levels are preserved in `rel_path`. Arbitrary irregular real-world folder structures **will require admin overrides/classification rules** in the production build. The current dashboard displays registered source paths to anyone with the pilot password; this is not suitable for college-wide access.

## Security and production limitations

**Do not publish this pilot on the internet or connect all 90 TB before a security review.**

- Shared login is for localhost testing only; implement institution SSO (OIDC/SAML), separate admin roles, user access rules and session revocation.
- Add reverse proxy HTTPS, brute-force protection/rate limiting, CSRF review, monitoring, antivirus and robust audit logging.
- Add scan worker locking, backoff, retry/resume, batched writes, job queue and filesystem error handling for very large file counts.
- Scan jobs do not currently retain partial progress across restarts. Do a preliminary inventory with file counts and workload benchmark.
- The read-only admin page is a pilot, not an interactive storage management console. Source paths are registered from the terminal to avoid exposing an arbitrary-disk scanning API.
- Add per-department access/usage rights, remove broken/unlicensed materials, and confirm NPTEL distribution permissions before student access.
- Add browser-accessible media transcoding **only on demand** if videos are in codecs unsupported by modern browsers; do not transcode 90 TB automatically.
- Implement NGINX `X-Accel-Redirect` or signed object-store URLs, per-user rate controls and observability for high concurrency; the Node file stream is fine for functional proof of concept.
- Harden file serving against mount changes/time-of-check-time-of-use races and account for OS symlinks and reparse points. Enforce read-only file permissions.
- Add verified backup/restore for metadata database and an independent backup plan for media, especially if current disks contain the only copy.
- Current file scanner uses one SQL upsert per file; batch inserts and use bounded queues for million-file datasets.

## Production architecture (target)

```
Students -> HTTPS NGINX -> Next.js portal & REST APIs -> PostgreSQL catalogue
                               |       |
                          permissions  file-serving adapter
                                           |
                              registered read-only storage mounts
                                       (90 TB)

                 separate scheduler -> scanner worker -> PostgreSQL
```

**Why no Vercel-only deployment?** A cloud app cannot read an on-campus USB drive unless a separate agent/network file service exposes it; that adds security and latency concerns. Self-host Next.js next to the storage or expose a tightly controlled on-premises service via a secure private network.

## Developer backlog / user stories

1. **MREM-01:** Administrators register multiple disks and see health/status through a secure admin-only UI.
2. **MREM-02:** Scanner supports per-source classification rules, folder aliases and manual corrections.
3. **MREM-03:** Search pagination, filtering, course hierarchies and filename full-text/fuzzy indexing.
4. **MREM-04:** Students authenticate via college SSO; permissions depend on role and access policy.
5. **MREM-05:** Download service supports byte ranges, large media and concurrent streaming with proper monitoring.
6. **MREM-06:** Admin can monitor scan jobs, storage health, gaps and inaccessible content.
7. **MREM-07:** Repeated scans reconcile metadata without dropping files on unplugged disks.
8. **MREM-08:** Production deployment includes system service, backups, TLS and documented recovery.

## Suggested Claude Code brief

> You are taking over the existing `mrem-nextjs-starter` pilot. First inspect all code and README. Keep existing disks read-only, never copy/move/delete media. Begin by running the app against sample data and adding automated tests. Then implement: separate SSO roles and authentication, fine-grained access control, proper admin registration forms, configurable academic classification rules, batched/resumable scans, queue-backed jobs, storage health reporting, secure streaming via NGINX, performance testing and infrastructure scripts. Before production use, create an architecture decision record, threat model and release checklist. Do not access production disks without explicit college IT approval. Validate end-to-end on one approved read-only sample drive before indexing the full 90 TB.

## Important note on XAMPP

This is a **Node.js/Next.js** project, not PHP. **XAMPP is not needed**. You may use PostgreSQL + Next.js on Windows or Linux, behind a reverse proxy. Don't try to install the code into XAMPP's `htdocs` like a Joomla/PHP application.