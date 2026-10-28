# MREM Digital Library architecture decisions

## Decision 1: Separate the catalogue from media
The PostgreSQL database contains metadata and storage pointers only. Original videos/PDFs remain on mounted drives. There is no 90 TB import operation.

## Decision 2: Logical source IDs + relative paths
File reference: `source_id=nptel01`, `rel_path=Aerospace Engineering/Aerodynamics/Lecture01.mp4`. Never expose root paths in URLs and don't bind permanent references to changeable drive letters.

## Decision 3: Scan in a separate worker
HTTP requests query indexed metadata. They never recurse a 90 TB tree. Scan must be repeatable, incremental, throttled and recoverable. The pilot is sequential/functional, not yet performance-optimized.

## Decision 4: Self host near storage
The Next.js Node runtime must have read-only access to mounted storage. A CDN/cloud frontend could be introduced later, but an on-campus backend agent would still be required.

## Decision 5: Secure file IDs
Download links contain database IDs, not user-controlled paths. Server checks session, configured storage source, permitted media record, and resolved path containment before streaming. This is preliminary hardening; production needs RBAC and more robust OS integration.

## Decision 6: A library, not a new LMS
The pilot deliberately does NOT implement quizzes, assignment submission, progress tracking, grading or course authoring.

## Decision 7: Technology choice
Next.js 16 + React + TypeScript, PostgreSQL 17, Node.js worker, with an optional production NGINX data path. React handles UI, APIs handle auth/catalogue/streaming, and workers handle heavy filesystem indexing.