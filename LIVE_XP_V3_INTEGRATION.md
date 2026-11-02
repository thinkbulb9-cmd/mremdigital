# MREM LMS — Version 3 design connected to the existing campus catalogue

**Review branch:** `ui/experience-refresh-preview`  
**Status:** Code integration and sandbox regression tests passed. **Not deployed to the college Windows Server; not merged into `main`.**

## What is implemented

The approved Version 3 design is reused throughout the student application, including its Inter typography, institutional maroon/navy palette, Bento cards, academic imagery, full-width content and no-sidebar navigation.

The following routes use the actual campus database instead of UI demo arrays:

- `/` — verified unique course statistics, video/web/PDF/document metrics, approved departments, featured courses, MREM announcements
- `/departments` and `/departments/[department]` — real approved department records and course pages
- `/courses` and `/video-courses` — real searchable and paginated catalogue
- `/courses/[courseId]` — actual course offerings and resource lists
- `/courses/[courseId]/lessons/[resourceId]` — secure inline viewer with real original resource, verified lesson name and named previous/next links
- `/web-courses`, `/web-courses/[department]`, `/web-courses/[department]/[courseId]` and `.../pages/[resourceId]` — real NPTEL Web Course classification and safe rendered HTML pages
- `/study-materials` — real approved documents and PDFs

`/ux-preview` continues to be a **separate demonstration** with clearly labeled illustrative examples. It does not access the academic archive.

The frontend never receives source-drive paths; it links to indexed resource IDs, with the existing streaming and publication rules unchanged. The app supports whichever authorized storage sources the server currently has registered (including E:, F:, G:, H:).

## Font and deployment reliability

The exact **Inter** typeface is now bundled from `@fontsource-variable/inter` and is locally served. It no longer requires a Google Fonts connection during build.

**Important:** The repository does not currently have a committed `package-lock.json`. On the Windows Server use `npm install` (not `npm ci`), then generate and review a lockfile for the eventual production release.

## Live data and freshness

The student-facing data comes from `lib/campus-catalog.ts`, which only reads actual indexed, published resources using the current PostgreSQL configuration. No demo values are used in live pages.

The catalogue caches course summaries for five minutes by default; this is configurable through `MREM_CATALOG_CACHE_SECONDS`. It is **live database-backed data, not a millisecond-by-millisecond push feed**. A five-minute cache is intentional to avoid repeated expensive queries on a large archive.

## Windows Server installation review

Run this only on the authorized Windows Server, in a terminal with the correct access:

```powershell
cd C:\MREM\mremdigital
git status
git branch --show-current
git fetch origin
```

First protect all uncommitted local work and verify the exact current branch. If the working tree is clean and its contents have been preserved, check out the review branch using the local team's standard safe Git workflow:

```powershell
git switch --track origin/ui/experience-refresh-preview
npm install
npm run typecheck
npm run test:stream
npm run test:legacy
npm run test:nptel
npm run build
npm run storage:check
```

Ensure `.env.local` is retained locally and has the correct `DATABASE_URL` and `MREM_CAMPUS_PUBLIC=enabled`. The existing college publication-review and approval policy must remain active, typically `MREM_CAMPUS_REQUIRE_APPROVAL=enabled`.

Use `npm start` for loopback-only testing. **Do not open the college LAN or firewall just to review styling.** To enable student network access later, follow `CAMPUS_LMS_FOUR_DRIVES.md`, obtain institutional approval and test from a second authorized campus computer.

No indexing or database migration is required by the UI change itself.

## Evidence and limits

Verified in a fresh Vercel sandbox from the review branch:

- TypeScript compilation: pass
- Next.js production build: pass
- Range-stream, HTML legacy, NPTEL reconciliation tests: **30/30 pass**
- `/`, `/departments`, `/courses`, `/video-courses`, `/web-courses`, `/study-materials`, `/ux-preview`: HTTP 200 in off-campus mode
- No database connection attempts when campus mode is disabled

**Not verified:** Actual Windows Server availability, contents on E:/F:/G:/H:, real PostgreSQL row totals, original MP4/PDF/HTML playback, performance with campus traffic, and final LAN URL.

Never treat Vercel demo results as proof of on-premises deployment. Never put original media, secrets or private file inventories in GitHub.

## Approval

Review the design and source on this branch. Only merge into `main` and deploy locally once the college server's working tree is protected and real-file smoke tests pass.
