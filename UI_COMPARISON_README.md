# MREM Open LMS — Brand Design v2 (Comparison Branch)

This branch is a **design implementation**, not a migration of the college storage archive.

## No-login demonstration

The home page `/` and `/design-preview` open the same MREM-branded LMS UI without a student account. The deployment can be used to compare design work with Claude Code's locally running Windows Server version.

This version is intentionally populated with a small set of course-level titles and faculty attributed to the supplied NPTEL catalogue, plus plainly marked **synthetic example resources**. The sample video and PDF are original tiny fixtures and are *not* copies of NPTEL content.

### Working UI interactions

- MREM official college logo linked to the official university-hosted image; offline college deployment must vendor an authorized local logo copy.
- Auto-rotating MREM-only announcement slides with clickable arrows and dots.
- Global navigation, department shortcuts and department cards.
- Searchable/filterable course catalogue (sample data).
- Persistent desktop lesson navigation and a mobile lesson drawer.
- Inline video playback via tiny synthetic test video `/demo/mrem-preview.mp4`.
- Inline PDF preview via generated synthetic PDF at `/design-preview/sample-pdf`.
- Inline rendered HTML table sample inside script-disabled sandbox.
- Text content viewing, previous/next resource controls, temporary bookmark state.
- An empty state for Uncategorized Resources: never invent source directories.
- Responsive typography, hover/focus styles, reduced-motion support.

### Banner image assets

- `/lms-art/academic.svg`
- `/lms-art/library.svg`
- `/lms-art/innovation.svg`

The artwork is original SVG stored in the repository and works offline.

## Security and no-login scope

**No login** means the design preview can be browsed anonymously. It does **not** authorize internet publishing of actual E:, F:, G: and H: archives. Do not connect original educational media to the public demo or bypass campus publication approval.

The branch does not alter resource storage, file APIs, PostgreSQL, Windows Server configuration, original drive files, or Claude Code's local `legacy-html-catalogue` branch.

## Comparing with Claude's version

1. Visit the no-login preview.
2. Compare overview, banner carousel, departments, catalogue and course workspace at mobile and desktop widths.
3. Choose preferred parts.
4. Apply selected UI components to the college server branch only after metadata, security, and media endpoints are verified.
