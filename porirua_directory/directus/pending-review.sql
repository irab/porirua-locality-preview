-- Additive inbox SQL. Applied on every Directus bootstrap.
-- The pending_review view is SQL-only — do not register it as a Directus
-- collection. The schema inspector does not surface a plain view, so
-- /items/pending_review 403s. The editor inbox is review_queue_items.

CREATE OR REPLACE FUNCTION review_queue_change_summary(kind text, proposed jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN kind = 'new' THEN 'New listing from FSD'
    WHEN kind = 'removed' THEN 'No longer in the FSD feed'
    WHEN kind = 'geocode_flag' THEN COALESCE(
      NULLIF(proposed->'geocode_flag'->>'detail', ''),
      NULLIF(proposed->'geocode_flag'->>'code', ''),
      'Geocode flag'
    )
    WHEN kind = 'changed' THEN (
      SELECT COALESCE('Changing ' || string_agg(key, ', ' ORDER BY key), 'Changed fields')
      FROM (
        SELECT a.key
        FROM jsonb_object_keys(COALESCE(proposed->'after', '{}'::jsonb)) AS a(key)
        WHERE a.key IN (
          'name', 'serviceName', 'title', 'address', 'phone', 'url',
          'description', 'lat', 'lng', 'categories', 'email'
        )
          AND COALESCE(proposed->'before', '{}'::jsonb) -> a.key
              IS DISTINCT FROM proposed->'after' -> a.key
        ORDER BY a.key
        LIMIT 8
      ) changed
    )
    ELSE initcap(replace(kind, '_', ' '))
  END
$$;

ALTER TABLE review_queue_items
  ADD COLUMN IF NOT EXISTS change_summary text
  GENERATED ALWAYS AS (review_queue_change_summary(kind, proposed)) STORED;

-- Directus may add this when registering the listing M2O. entity_id is a
-- loose pointer (not always a service FK) and must stay that way.
ALTER TABLE review_queue_items DROP CONSTRAINT IF EXISTS review_queue_items_entity_id_foreign;

DROP VIEW IF EXISTS pending_review;
CREATE VIEW pending_review AS
SELECT
  q.id,
  q.import_run_id,
  q.entity_type,
  q.entity_id,
  q.kind,
  q.proposed,
  q.status,
  q.created_at,
  q.updated_at,
  s.status AS service_status,
  s.raw_import,
  q.change_summary
FROM review_queue_items q
LEFT JOIN services s
  ON q.entity_type = 'service' AND q.entity_id = s.id
WHERE q.status = 'pending';
