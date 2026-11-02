-- Stable identity and availability for every registered storage source (any drive letter, mount or share).
-- volume_serial is the Windows volume serial number of the root (stat.dev); a drive letter can change, the serial does not.
ALTER TABLE storage_sources ADD COLUMN IF NOT EXISTS volume_serial TEXT;
ALTER TABLE storage_sources ADD COLUMN IF NOT EXISTS volume_label TEXT;
ALTER TABLE storage_sources ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE storage_sources ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE storage_sources ADD COLUMN IF NOT EXISTS last_error TEXT;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='storage_sources_availability_check')THEN
  ALTER TABLE storage_sources ADD CONSTRAINT storage_sources_availability_check
   CHECK(availability IN ('unknown','available','unavailable','identity_mismatch'));
 END IF;
END$$;
