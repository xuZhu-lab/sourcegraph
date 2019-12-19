BEGIN;

DELETE FROM repo WHERE external_service_type IS NULL OR external_service_id IS NULL OR external_id IS NULL;

-- TODO make external_service columns never null

ALTER TABLE repo
  DROP CONSTRAINT deleted_at_unused,
  ADD CONSTRAINT external_service_unique UNIQUE (external_service_type, external_service_id, external_id);

COMMIT;
