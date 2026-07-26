-- Nothing from Notion gets left behind.
--
-- Two kinds of content the app never rendered, but that exist in the log and
-- would be lost forever once Notion is retired:
--
--  1. Free-text Notes on event types whose reader ignored the field (wake_up,
--     sleep_start, caffeine, mood, energy) — 139 of the 274 app events.
--     `events.notes` holds that text. For meal and gym-session the Notes
--     property carried the {v:1,...} JSON envelope instead, and that is
--     already decomposed into description/protein_g/calories/exercises, so
--     those rows leave `notes` null rather than storing it twice.
--
--  2. 170 rows whose `Type` predates the app's nine event types (journal,
--     snooker, work, travel, melatonin, legacy_note, observations…). They are
--     not app events and must not appear in the floor feed, so they live in
--     their own table rather than as permanently-filtered rows in `events`.
--     `properties` keeps the untouched Notion property blob, so anything this
--     schema did not think to name is still recoverable.

ALTER TABLE events ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS legacy_events (
  id           uuid PRIMARY KEY,
  type         text NOT NULL,
  category     text,
  title        text,
  occurred_at  text,
  -- Some legacy rows carry a bare date ("2026-07-26") with no time or offset,
  -- so the sortable instant is best-effort and may be null.
  occurred_ts  timestamptz,
  notes        text,
  properties   jsonb NOT NULL,
  created_time timestamptz,
  imported_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legacy_events_ts_idx ON legacy_events (occurred_ts DESC);
CREATE INDEX IF NOT EXISTS legacy_events_type_idx ON legacy_events (type);
