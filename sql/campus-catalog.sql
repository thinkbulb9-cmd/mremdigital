CREATE TABLE IF NOT EXISTS course_catalog(
 course_code TEXT PRIMARY KEY, title TEXT NOT NULL,
 department TEXT NOT NULL DEFAULT 'Unclassified',instructor TEXT,institution TEXT,
 title_source TEXT NOT NULL DEFAULT 'unverified',verified BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE resources ADD COLUMN IF NOT EXISTS course_code TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS semester_name TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS module_no INTEGER;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS lecture_no INTEGER;
CREATE INDEX IF NOT EXISTS idx_resources_campus_course ON resources(course_code,id) WHERE availability='available';
CREATE INDEX IF NOT EXISTS idx_resources_campus_module ON resources(course_code,module_no,lecture_no);
CREATE INDEX IF NOT EXISTS idx_course_catalog_department ON course_catalog(department);
