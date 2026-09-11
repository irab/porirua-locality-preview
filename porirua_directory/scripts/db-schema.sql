-- Phase 2 catalog schema.
--
-- counts.community, counts.fsd, and counts.duplicatesHidden are merge-input
-- sizes that cannot be recovered from published cards (382 FSD input rows
-- became 162 published lines). Bootstrap copies them from the committed
-- envelope into import_runs.stats. Once the weekly sync task lands they must
-- come from that job's import_runs stats rather than staying frozen.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  render_grain text NOT NULL CHECK (render_grain IN ('flat', 'organization')),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  lat numeric,
  lng numeric,
  org_type text NOT NULL DEFAULT '',
  community_filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  community_meta jsonb,
  source_primary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'hidden')),
  duplicate_of text REFERENCES organizations (id),
  merged_into text REFERENCES organizations (id),
  merge_reason text,
  cluster_key text NOT NULL,
  sort_key integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS organizations_cluster_key_idx ON organizations (cluster_key);
CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations (status);
CREATE INDEX IF NOT EXISTS organizations_merged_into_idx ON organizations (merged_into)
  WHERE merged_into IS NOT NULL;

CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id),
  line_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  service_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  lat numeric,
  lng numeric,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT '',
  fsd_service_id text,
  fsd_legacy_id text,
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'hidden', 'pending_review')),
  duplicate_of text REFERENCES services (id),
  raw_import jsonb,
  sort_key integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, line_id)
);

CREATE INDEX IF NOT EXISTS services_organization_id_idx ON services (organization_id);
CREATE INDEX IF NOT EXISTS services_fsd_service_id_idx ON services (fsd_service_id);
CREATE INDEX IF NOT EXISTS services_status_idx ON services (status);

CREATE TABLE IF NOT EXISTS public_id_aliases (
  old_public_id text PRIMARY KEY,
  new_public_id text NOT NULL,
  entity_type text NOT NULL DEFAULT 'organization',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_snapshots (
  version bigserial PRIMARY KEY,
  envelope jsonb NOT NULL,
  counts jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  published_by text,
  is_current boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_snapshots_one_current
  ON catalog_snapshots (is_current)
  WHERE is_current;

CREATE TABLE IF NOT EXISTS overrides (
  id text PRIMARY KEY,
  target_type text NOT NULL,
  target_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('hide', 'patch', 'link_duplicate', 'community_owned')),
  patch jsonb,
  reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, action)
);

CREATE TABLE IF NOT EXISTS import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  fsd_csv_url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_message text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text
);

CREATE INDEX IF NOT EXISTS import_runs_source_started_idx ON import_runs (source, started_at DESC);

CREATE TABLE IF NOT EXISTS review_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL REFERENCES import_runs (id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('new', 'changed', 'removed', 'geocode_flag')),
  proposed jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_queue_items_run_idx ON review_queue_items (import_run_id);
CREATE INDEX IF NOT EXISTS review_queue_items_status_idx ON review_queue_items (status);
CREATE INDEX IF NOT EXISTS review_queue_items_entity_idx ON review_queue_items (entity_type, entity_id);

-- Readable inbox column. Directus cannot inspect the pending_review view, so
-- the editor-facing list is this table plus this summary instead of raw JSON.
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

ALTER TABLE overrides DROP CONSTRAINT IF EXISTS overrides_action_check;
ALTER TABLE overrides ADD CONSTRAINT overrides_action_check
  CHECK (action IN ('hide', 'patch', 'link_duplicate', 'community_owned'));

ALTER TABLE review_queue_items DROP CONSTRAINT IF EXISTS review_queue_items_status_check;
ALTER TABLE review_queue_items ADD CONSTRAINT review_queue_items_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded'));

CREATE TABLE IF NOT EXISTS editor_undo (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  snapshot jsonb NOT NULL
);

-- Who published, undid, or rolled a snapshot back. Directory shows the versions.
CREATE TABLE IF NOT EXISTS catalog_publish_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('publish', 'undo-publish', 'rollback')),
  snapshot_version bigint NOT NULL REFERENCES catalog_snapshots (version),
  previous_version bigint REFERENCES catalog_snapshots (version),
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE catalog_publish_events DROP CONSTRAINT IF EXISTS catalog_publish_events_action_check;
ALTER TABLE catalog_publish_events ADD CONSTRAINT catalog_publish_events_action_check
  CHECK (action IN ('publish', 'undo-publish', 'rollback'));

CREATE INDEX IF NOT EXISTS catalog_publish_events_created_idx
  ON catalog_publish_events (created_at DESC);
