-- Metadata only: media stays on existing storage.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS storage_sources (
 id TEXT PRIMARY KEY,name TEXT NOT NULL,root_path TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,
 last_successful_scan TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS folders (
 id BIGSERIAL PRIMARY KEY,source_id TEXT NOT NULL REFERENCES storage_sources(id),
 rel_path TEXT NOT NULL,parent_rel_path TEXT NOT NULL DEFAULT '',name TEXT NOT NULL,last_seen_scan TEXT,
 UNIQUE(source_id,rel_path));
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(source_id,parent_rel_path);
CREATE TABLE IF NOT EXISTS resources (
 id BIGSERIAL PRIMARY KEY,source_id TEXT NOT NULL REFERENCES storage_sources(id),
 rel_path TEXT NOT NULL,folder_rel_path TEXT NOT NULL DEFAULT '',name TEXT NOT NULL,ext TEXT NOT NULL,
 kind TEXT NOT NULL,size_bytes BIGINT NOT NULL,modified_at TIMESTAMPTZ NOT NULL,
 department TEXT NOT NULL DEFAULT 'Unclassified',course TEXT NOT NULL DEFAULT 'General',
 availability TEXT NOT NULL DEFAULT 'available' CHECK(availability IN ('available','missing')),
 last_seen_scan TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(source_id,rel_path));
CREATE INDEX IF NOT EXISTS idx_resources_department_course ON resources(department,course);
CREATE INDEX IF NOT EXISTS idx_resources_kind ON resources(kind);
CREATE INDEX IF NOT EXISTS idx_resources_name_trgm ON resources USING GIN(name gin_trgm_ops);
CREATE TABLE IF NOT EXISTS scan_jobs (
 id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES storage_sources(id),status TEXT NOT NULL,
 files_seen BIGINT NOT NULL DEFAULT 0,folders_seen BIGINT NOT NULL DEFAULT 0,error TEXT,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),completed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS download_events(
 id BIGSERIAL PRIMARY KEY,resource_id BIGINT NOT NULL REFERENCES resources(id),
 at TIMESTAMPTZ NOT NULL DEFAULT now(),range_request BOOLEAN NOT NULL DEFAULT FALSE);
