-- Provenance for metadata extracted from legacy NPTEL HTML catalogues on the archive.
-- Archive files are only read; these tables record what was found, where, and how confidently.
CREATE TABLE IF NOT EXISTS legacy_catalogue_sources(
 source_id TEXT NOT NULL REFERENCES storage_sources(id),rel_path TEXT NOT NULL,
 semester_root TEXT NOT NULL,root_recognized BOOLEAN NOT NULL,level TEXT NOT NULL,layout TEXT NOT NULL,
 status TEXT NOT NULL,course_rows INTEGER NOT NULL DEFAULT 0,content_links INTEGER NOT NULL DEFAULT 0,
 size_bytes BIGINT,modified_at TIMESTAMPTZ,run_key TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(source_id,rel_path));
-- One row per course per semester per catalogue page: semester differences are kept, never merged away.
CREATE TABLE IF NOT EXISTS legacy_course_records(
 source_id TEXT NOT NULL REFERENCES storage_sources(id),semester_root TEXT NOT NULL,
 course_code TEXT NOT NULL CHECK(course_code ~ '^[0-9]{9}$'),source_rel_path TEXT NOT NULL,
 discipline_folder TEXT NOT NULL DEFAULT '',title TEXT NOT NULL,discipline TEXT NOT NULL DEFAULT '',
 coordinators TEXT NOT NULL DEFAULT '',course_type TEXT NOT NULL DEFAULT '',institution TEXT NOT NULL DEFAULT '',
 inventory_files INTEGER NOT NULL DEFAULT 0,confidence TEXT NOT NULL,run_key TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(source_id,semester_root,course_code,source_rel_path));
CREATE INDEX IF NOT EXISTS idx_legacy_course_records_code ON legacy_course_records(course_code);
-- A catalogue link resolved to one indexed file (matched by source, semester, course and exact relative path).
CREATE TABLE IF NOT EXISTS legacy_resource_links(
 source_id TEXT NOT NULL REFERENCES storage_sources(id),source_rel_path TEXT NOT NULL,link_ref TEXT NOT NULL,
 resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,course_code TEXT NOT NULL,
 semester_root TEXT NOT NULL,module_no INTEGER,lecture_no INTEGER,label TEXT NOT NULL DEFAULT '',
 match_method TEXT NOT NULL,confidence TEXT NOT NULL,run_key TEXT NOT NULL,
 PRIMARY KEY(source_id,source_rel_path,link_ref));
CREATE INDEX IF NOT EXISTS idx_legacy_resource_links_resource ON legacy_resource_links(resource_id);
-- Lecture title tied to one exact file, so each semester's copy keeps its own catalogue title.
CREATE TABLE IF NOT EXISTS legacy_lecture_titles(
 resource_id BIGINT PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE,
 course_code TEXT NOT NULL,semester_root TEXT NOT NULL,module_no INTEGER,lecture_no INTEGER,
 title TEXT NOT NULL,source_rel_path TEXT NOT NULL,confidence TEXT NOT NULL,run_key TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_legacy_lecture_titles_course ON legacy_lecture_titles(course_code);
CREATE TABLE IF NOT EXISTS legacy_mapping_conflicts(
 id BIGSERIAL PRIMARY KEY,conflict_type TEXT NOT NULL,course_code TEXT NOT NULL DEFAULT '',
 semester_root TEXT NOT NULL DEFAULT '',field TEXT NOT NULL DEFAULT '',existing_value TEXT NOT NULL DEFAULT '',
 extracted_value TEXT NOT NULL DEFAULT '',source_rel_path TEXT NOT NULL DEFAULT '',resolution TEXT NOT NULL,
 reviewed BOOLEAN NOT NULL DEFAULT FALSE,run_key TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(conflict_type,course_code,semester_root,field,source_rel_path,extracted_value));
-- Checkpoints: a re-run of the same extraction skips batches already committed.
CREATE TABLE IF NOT EXISTS legacy_import_runs(
 run_key TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES storage_sources(id),
 status TEXT NOT NULL CHECK(status IN ('running','completed','failed')),batches_total INTEGER NOT NULL,
 batches_done INTEGER NOT NULL DEFAULT 0,backup_suffix TEXT,summary JSONB NOT NULL DEFAULT '{}'::jsonb,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),completed_at TIMESTAMPTZ,error TEXT);
