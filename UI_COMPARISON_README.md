# MREM UI/UX Comparison — Concept A

This isolated branch is for visual and interaction comparison only. **Do not merge it into the campus server until the user chooses a design.**

## Live preview

Open the branch's Vercel preview at `/design-preview`. It uses illustrative catalogue entries and self-contained sample learning resources. Real E:, F:, G:, H: storage is **not** connected to the Vercel preview.

## Design concepts

- Compact professional MREM digital library navigation; branded placeholder icon awaits exact college-approved logo.
- Department directory, course catalogue, course selection and contextual lesson sidebar.
- Inline video, PDF, HTML and text viewer layouts with navigation maintained alongside content.
- Search/filter functionality based on the sample catalogue.
- Dedicated uncategorized-resources state (no invented filenames).
- Responsive desktop/tablet/mobile layouts including a mobile lesson drawer.
- Typography scaled for an everyday SaaS learning app.

## Explicit scope

Only three files were created for this design preview:

- `app/design-preview/page.tsx`
- `components/LibraryDesignPreview.tsx`
- `components/library-design-preview.css`

No live student route, database migration, existing file APIs, storage scanner, security policy or student publication setting is changed.

## Sample data warning

Some course-level examples match titles in the supplied NPTEL catalogue, but all displayed course counts, lesson titles and preview resources are illustrative. They are not verified contents of the college server. Real lecture titles must be selected from approved mappings before production integration.

## How to compare

1. Open `/design-preview` on the Vercel branch preview URL.
2. Evaluate department navigation, course list, course workspace, in-place video/document viewing, mobile layout and typography.
3. Compare directly against Claude Code's local Windows Server version.
4. Choose which design or components to adopt.
5. Only then port approved UI elements to the main campus application and connect existing server APIs.

The separate branch avoids conflicts with Claude Code's unpushed `legacy-html-catalogue` work.
