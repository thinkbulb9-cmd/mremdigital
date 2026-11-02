-- Student LMS: lecture titles tied to exact files, folder-level approval for uncategorized material, browse indexes.
-- Lecture title for one indexed file with its evidence. Only HIGH is shown to students; MEDIUM stays for review.
CREATE TABLE IF NOT EXISTS lecture_titles(
 resource_id BIGINT PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE,
 course_code TEXT NOT NULL,title TEXT NOT NULL,
 confidence TEXT NOT NULL CHECK(confidence IN ('HIGH','MEDIUM')),
 source TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '',source_url TEXT NOT NULL DEFAULT '',
 imported_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_lecture_titles_course ON lecture_titles(course_code) WHERE confidence='HIGH';
CREATE INDEX IF NOT EXISTS idx_lecture_titles_title_trgm ON lecture_titles USING GIN(title gin_trgm_ops) WHERE confidence='HIGH';
-- A folder (and everything below it) that the college approved for students when it has no course ID.
CREATE TABLE IF NOT EXISTS campus_folder_publications(
 source_id TEXT NOT NULL REFERENCES storage_sources(id),rel_path TEXT NOT NULL,
 approved BOOLEAN NOT NULL DEFAULT FALSE,reviewed_by TEXT NOT NULL DEFAULT '',reviewed_at TIMESTAMPTZ,
 notes TEXT NOT NULL DEFAULT '',PRIMARY KEY(source_id,rel_path));
CREATE INDEX IF NOT EXISTS idx_resources_uncategorized_folder ON resources(source_id,folder_rel_path)
 WHERE course_code IS NULL AND availability='available';
CREATE INDEX IF NOT EXISTS idx_resources_folder ON resources(source_id,folder_rel_path);
CREATE INDEX IF NOT EXISTS idx_resources_course_semester ON resources(course_code,semester_name) WHERE availability='available';
-- NPTEL content type of each course (Video or Web) and where it came from; Web Courses are listed from this.
ALTER TABLE course_catalog ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE course_catalog ADD COLUMN IF NOT EXISTS content_type_source TEXT;
CREATE INDEX IF NOT EXISTS idx_course_catalog_content_type ON course_catalog(content_type);
