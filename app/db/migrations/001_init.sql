-- Initial schema: the three domains that used to live in Notion databases.
--
-- Timestamp convention (important): `occurred_at` is stored as TEXT holding the
-- exact ISO 8601 string with the offset of the moment it happened — the same
-- shape Notion returned. lib/time.ts reads the wall-clock part of that string
-- to group days and nights, so the original offset must survive round-trips.
-- `occurred_ts` is the same instant as a real timestamptz, written alongside it
-- purely so ordering, range filters and indexes are correct and fast.

CREATE TABLE IF NOT EXISTS events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text        NOT NULL,
  category         text        NOT NULL,
  occurred_at      text        NOT NULL,
  occurred_ts      timestamptz NOT NULL,
  precision        text        NOT NULL DEFAULT 'exact',
  -- nap minutes; gym-session minutes live in session_duration, no longer
  -- sharing one column the way Notion's "Duration (min)" forced them to.
  duration         integer,
  intensity        integer,
  kind             text,
  scope            text,
  meal_name        text,
  description      text,
  protein_g        numeric,
  calories         numeric,
  session_duration integer,
  exercises        jsonb,
  -- Soft delete only: deletes stay reversible, as Notion's archive was.
  archived_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- /api/today and /api/week: "everything since <ts>", ascending.
CREATE INDEX IF NOT EXISTS events_live_ts_idx
  ON events (occurred_ts) WHERE archived_at IS NULL;

-- /api/history: one type, newest first, cursor-paged.
CREATE INDEX IF NOT EXISTS events_type_ts_idx
  ON events (type, occurred_ts DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS cbt_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at       text        NOT NULL,
  occurred_ts       timestamptz NOT NULL,
  trigger           text        NOT NULL DEFAULT '',
  thought           text        NOT NULL DEFAULT '',
  emotion           text        NOT NULL,
  intensity_before  integer     NOT NULL,
  intensity_after   integer     NOT NULL,
  distortions       text[]      NOT NULL DEFAULT '{}',
  evidence_for      text[]      NOT NULL DEFAULT '{}',
  evidence_against  text[]      NOT NULL DEFAULT '{}',
  reframe           text        NOT NULL DEFAULT '',
  archived_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cbt_records_ts_idx
  ON cbt_records (occurred_ts DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  protein_g   numeric,
  calories    numeric,
  ingredients text[]      NOT NULL DEFAULT '{}',
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipes_name_idx
  ON recipes (name) WHERE archived_at IS NULL;
