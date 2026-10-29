-- Roles, review workflow and resolved catalogue mappings (original files never changed).
CREATE TABLE IF NOT EXISTS departments(
 id BIGSERIAL PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS courses(
 id BIGSERIAL PRIMARY KEY,department_id BIGINT NOT NULL REFERENCES departments(id),
 code TEXT NOT NULL,name TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,UNIQUE(department_id,code)
);
CREATE TABLE IF NOT EXISTS staff_users(
 id BIGSERIAL PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('hod','librarian','super_admin')),
 department_id BIGINT REFERENCES departments(id),active BOOLEAN NOT NULL DEFAULT TRUE,
 failed_logins INTEGER NOT NULL DEFAULT 0,locked_until TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((role='hod' AND department_id IS NOT NULL) OR (role<>'hod' AND department_id IS NULL))
);
CREATE TABLE IF NOT EXISTS staff_sessions(
 session_hash TEXT PRIMARY KEY,staff_user_id BIGINT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS staff_sessions_user_idx ON staff_sessions(staff_user_id);
CREATE TABLE IF NOT EXISTS hod_source_grants(
 staff_user_id BIGINT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
 source_id TEXT NOT NULL REFERENCES storage_sources(id) ON DELETE CASCADE,
 PRIMARY KEY(staff_user_id,source_id)
);
CREATE TABLE IF NOT EXISTS mapping_requests(
 id BIGSERIAL PRIMARY KEY,source_id TEXT NOT NULL REFERENCES storage_sources(id),
 scope TEXT NOT NULL CHECK(scope IN ('folder','file')),rel_path TEXT NOT NULL,
 department_id BIGINT NOT NULL REFERENCES departments(id),course_id BIGINT REFERENCES courses(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 note TEXT NOT NULL DEFAULT '',submitted_by BIGINT NOT NULL REFERENCES staff_users(id),
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),reviewed_by BIGINT REFERENCES staff_users(id),
 reviewed_at TIMESTAMPTZ,review_note TEXT NOT NULL DEFAULT '',CHECK(rel_path<>'')
);
CREATE INDEX IF NOT EXISTS mapping_requests_status_idx ON mapping_requests(status,submitted_at DESC);
CREATE INDEX IF NOT EXISTS mapping_requests_dep_idx ON mapping_requests(department_id,submitted_at DESC);
CREATE TABLE IF NOT EXISTS published_mappings(
 id BIGSERIAL PRIMARY KEY,source_id TEXT NOT NULL REFERENCES storage_sources(id),
 scope TEXT NOT NULL CHECK(scope IN ('folder','file')),rel_path TEXT NOT NULL,
 department_id BIGINT NOT NULL REFERENCES departments(id),course_id BIGINT REFERENCES courses(id),
 approval_request_id BIGINT NOT NULL REFERENCES mapping_requests(id),
 active BOOLEAN NOT NULL DEFAULT TRUE,published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS published_mappings_one_active_path ON published_mappings(source_id,scope,rel_path) WHERE active;
CREATE INDEX IF NOT EXISTS published_mappings_source_idx ON published_mappings(source_id,active);
CREATE TABLE IF NOT EXISTS resource_assignments(
 resource_id BIGINT PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE,
 mapping_id BIGINT NOT NULL REFERENCES published_mappings(id),
 department_id BIGINT NOT NULL REFERENCES departments(id),
 course_id BIGINT REFERENCES courses(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_assignments_dept_idx ON resource_assignments(department_id,course_id);
CREATE TABLE IF NOT EXISTS mapping_jobs(
 id BIGSERIAL PRIMARY KEY,mapping_request_id BIGINT NOT NULL REFERENCES mapping_requests(id),
 source_id TEXT NOT NULL REFERENCES storage_sources(id),
 scope TEXT NOT NULL CHECK(scope IN ('folder','file')),rel_path TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
 last_resource_id BIGINT NOT NULL DEFAULT 0,processed_count BIGINT NOT NULL DEFAULT 0,
 started_at TIMESTAMPTZ,completed_at TIMESTAMPTZ,error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mapping_jobs_status_idx ON mapping_jobs(status,created_at);
CREATE TABLE IF NOT EXISTS staff_audit_logs(
 id BIGSERIAL PRIMARY KEY,actor_id BIGINT REFERENCES staff_users(id),
 action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,
 details JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_audit_logs_created_idx ON staff_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS staff_audit_logs_actor_idx ON staff_audit_logs(actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS resources_source_id_idx ON resources(source_id,id);
CREATE INDEX IF NOT EXISTS resources_source_path_pattern_idx ON resources(source_id,rel_path text_pattern_ops);
