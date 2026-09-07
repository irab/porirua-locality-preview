-- Editor inbox. Not a catalog table — a view over the existing queue.
CREATE OR REPLACE VIEW pending_review AS
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
  s.raw_import
FROM review_queue_items q
LEFT JOIN services s
  ON q.entity_type = 'service' AND q.entity_id = s.id
WHERE q.status = 'pending';
