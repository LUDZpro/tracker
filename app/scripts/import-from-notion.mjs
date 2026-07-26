#!/usr/bin/env node
/**
 * One-time migration: pull all three Notion databases into Postgres.
 *
 * Notion page ids are UUIDs, so they become the Postgres primary keys —
 * anything holding an old id (a queued offline write, an open tab) still
 * resolves after the cutover.
 *
 * Idempotent: re-running upserts by id, so an interrupted run can just be
 * repeated. Archived pages are never returned by Notion's query endpoint, so
 * they stay out, exactly as they were invisible to the app before.
 *
 *   node --env-file=../.env --env-file=../preview.env scripts/import-from-notion.mjs
 *
 * The parsing below is a faithful port of the (now removed) lib/mapping.ts,
 * lib/cbt/mapping.ts and lib/recipes/mapping.ts readers.
 */
import pg from 'pg';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';

const EVENTS_DS = '59f692c3-e817-4893-ad70-0134b9bb1ff2';
const CBT_DS = '5b558363-0e9f-4708-9436-922146d173d9';
const RECIPES_DS = '8b0358e9-dbee-4c07-96a4-7f5496659450';

const CATEGORY_BY_TYPE = {
  wake_up: 'marker',
  sleep_start: 'marker',
  nap: 'action',
  caffeine: 'intake',
  mood: 'state',
  energy: 'state',
  meal: 'action',
  'gym-session': 'action',
  trigger: 'state',
};

const CAFFEINE_KINDS = ['coffee', 'tea', 'energy', 'other'];
const CBT_EMOTIONS = ['anxious', 'sad', 'angry', 'ashamed', 'guilty', 'overwhelmed', 'hopeless'];
const CBT_DISTORTIONS = [
  'catastrophizing', 'all-or-nothing', 'mind reading', 'fortune telling',
  'emotional reasoning', 'overgeneralization', 'mental filter',
  'discounting positives', 'should statements', 'labeling', 'personalization',
];

// ---------------------------------------------------------------- Notion read

async function notionFetch(path, init) {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Notion ${init.method} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Every page of a data source, following Notion's cursor to the end. */
async function fetchAll(dataSourceId, sorts) {
  const pages = [];
  let cursor;
  do {
    const data = await notionFetch(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        ...(sorts ? { sorts } : {}),
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    pages.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
    process.stdout.write(`\r  fetched ${pages.length}…`);
  } while (cursor);
  process.stdout.write('\n');
  return pages;
}

const plainText = (prop) =>
  Array.isArray(prop?.rich_text) ? prop.rich_text.map((r) => r?.plain_text ?? '').join('') : '';
const titleText = (prop) =>
  Array.isArray(prop?.title) ? prop.title.map((r) => r?.plain_text ?? '').join('') : '';
const splitLines = (text) =>
  text.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);

// --------------------------------------------------------------- Row builders

/** True for a page the app itself would have rendered. Everything else is
 *  history from before the app narrowed to its nine types — preserved in
 *  legacy_events rather than dropped. */
function isAppEvent(page) {
  const props = page.properties;
  if (!page.id || !props) return false;
  if (page.archived || page.in_trash) return false;
  const type = props.Type?.rich_text?.[0]?.plain_text ?? props.Type?.select?.name;
  const occurredAt = props['Occurred at']?.date?.start;
  if (!type || !(type in CATEGORY_BY_TYPE) || !occurredAt) return false;
  return !Number.isNaN(Date.parse(occurredAt));
}

function eventRow(page) {
  const props = page.properties;
  if (!isAppEvent(page)) return null;

  const type = props.Type?.rich_text?.[0]?.plain_text ?? props.Type?.select?.name;
  const occurredAt = props['Occurred at']?.date?.start;

  const durationRaw = props['Duration (min)']?.number ?? null;
  const title = props.Event?.title?.[0]?.plain_text;
  const suffix = title?.split(' — ')[1];

  // Caffeine kind and meal name lived only in the title; they get real columns.
  const kind = type === 'caffeine' && CAFFEINE_KINDS.includes(suffix) ? suffix : null;
  const mealName = type === 'meal' ? (suffix ?? null) : null;

  // description/macros (meal) and exercises (gym) rode in a Notes JSON
  // envelope; a malformed value is dropped, never fatal. On every other type
  // Notes is free text the old reader ignored — it goes to `notes` so it
  // survives the cutover instead of dying with the Notion database.
  let description = null;
  let proteinG = null;
  let calories = null;
  let exercises = null;
  let notes = null;
  const notesRaw = plainText(props.Notes) || null;
  let envelopeParsed = false;
  if (notesRaw && (type === 'meal' || type === 'gym-session')) {
    try {
      const parsed = JSON.parse(notesRaw);
      if (parsed && typeof parsed === 'object' && parsed.v === 1) {
        envelopeParsed = true;
        if (type === 'meal') {
          if (typeof parsed.description === 'string') description = parsed.description;
          if (typeof parsed.proteinG === 'number') proteinG = parsed.proteinG;
          if (typeof parsed.calories === 'number') calories = parsed.calories;
        } else if (Array.isArray(parsed.exercises)) {
          exercises = JSON.stringify(parsed.exercises);
        }
      }
    } catch {
      /* malformed Notes — fall through and keep it as free text */
    }
  }
  // Only text that was NOT the envelope; an envelope is already decomposed
  // into its own columns and must not be stored twice.
  if (notesRaw && !envelopeParsed) notes = notesRaw;

  return [
    page.id,
    type,
    CATEGORY_BY_TYPE[type],
    occurredAt,
    new Date(Date.parse(occurredAt)),
    props.Precision?.select?.name ?? 'exact',
    // Duration (min) was shared by nap and gym-session; split it here.
    type === 'gym-session' ? null : durationRaw,
    props.Intensity?.number ?? null,
    kind,
    props.Scope?.select?.name ?? null,
    mealName,
    description,
    proteinG,
    calories,
    type === 'gym-session' ? durationRaw : null,
    exercises,
    notes,
  ];
}

/** A pre-app row, kept verbatim. `properties` is the untouched Notion blob so
 *  nothing this schema failed to anticipate is lost. */
function legacyRow(page) {
  const props = page.properties;
  if (!page.id || !props) return null;
  if (page.archived || page.in_trash) return null;
  if (isAppEvent(page)) return null; // already imported into `events`

  const type = props.Type?.rich_text?.[0]?.plain_text ?? props.Type?.select?.name ?? 'unknown';
  const occurredAt = props['Occurred at']?.date?.start ?? null;
  const ts = occurredAt && !Number.isNaN(Date.parse(occurredAt)) ? new Date(occurredAt) : null;

  return [
    page.id,
    type,
    props.Category?.select?.name ?? null,
    titleText(props.Event) || null,
    occurredAt,
    ts,
    plainText(props.Notes) || null,
    JSON.stringify(props),
    page.created_time ?? null,
  ];
}

function cbtRow(page) {
  const props = page.properties;
  if (!page.id || !props) return null;
  if (page.archived || page.in_trash) return null;

  const occurredAt = props.Date?.date?.start;
  const emotion = props.Emotion?.select?.name;
  const before = props['Intensity Before']?.number;
  const after = props['Intensity After']?.number;
  if (!occurredAt || typeof before !== 'number' || typeof after !== 'number') return null;
  if (!emotion || !CBT_EMOTIONS.includes(emotion)) return null;

  const distortions = Array.isArray(props.Distortions?.multi_select)
    ? props.Distortions.multi_select.map((o) => o?.name).filter((n) => CBT_DISTORTIONS.includes(n))
    : [];

  return [
    page.id,
    occurredAt,
    new Date(Date.parse(occurredAt)),
    plainText(props.Trigger),
    plainText(props.Thought),
    emotion,
    before,
    after,
    distortions,
    splitLines(plainText(props['Evidence For'])),
    splitLines(plainText(props['Evidence Against'])),
    plainText(props.Reframe),
  ];
}

function recipeRow(page) {
  const props = page.properties;
  if (!page.id || !props) return null;
  if (page.archived || page.in_trash) return null;

  const name = titleText(props.Name).trim();
  if (!name) return null;

  return [
    page.id,
    name,
    props.Protein?.number ?? null,
    props.Calories?.number ?? null,
    splitLines(plainText(props.Ingredients)),
  ];
}

// -------------------------------------------------------------------- Import

async function importTable(client, label, pages, toRow, sql) {
  let imported = 0;
  let skipped = 0;
  for (const page of pages) {
    const row = toRow(page);
    if (!row) {
      skipped++;
      continue;
    }
    await client.query(sql, row);
    imported++;
  }
  console.log(`  ${label}: ${imported} imported, ${skipped} skipped (unparseable/archived)`);
  return { imported, skipped };
}

const EVENTS_SQL = `
  INSERT INTO events (
    id, type, category, occurred_at, occurred_ts, precision, duration, intensity,
    kind, scope, meal_name, description, protein_g, calories, session_duration,
    exercises, notes
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
  ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type, category = EXCLUDED.category,
    occurred_at = EXCLUDED.occurred_at, occurred_ts = EXCLUDED.occurred_ts,
    precision = EXCLUDED.precision, duration = EXCLUDED.duration,
    intensity = EXCLUDED.intensity, kind = EXCLUDED.kind, scope = EXCLUDED.scope,
    meal_name = EXCLUDED.meal_name, description = EXCLUDED.description,
    protein_g = EXCLUDED.protein_g, calories = EXCLUDED.calories,
    session_duration = EXCLUDED.session_duration, exercises = EXCLUDED.exercises,
    notes = EXCLUDED.notes, updated_at = now()`;

const LEGACY_SQL = `
  INSERT INTO legacy_events (
    id, type, category, title, occurred_at, occurred_ts, notes, properties, created_time
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type, category = EXCLUDED.category, title = EXCLUDED.title,
    occurred_at = EXCLUDED.occurred_at, occurred_ts = EXCLUDED.occurred_ts,
    notes = EXCLUDED.notes, properties = EXCLUDED.properties,
    created_time = EXCLUDED.created_time`;

const CBT_SQL = `
  INSERT INTO cbt_records (
    id, occurred_at, occurred_ts, trigger, thought, emotion,
    intensity_before, intensity_after, distortions, evidence_for,
    evidence_against, reframe
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
  ON CONFLICT (id) DO UPDATE SET
    occurred_at = EXCLUDED.occurred_at, occurred_ts = EXCLUDED.occurred_ts,
    trigger = EXCLUDED.trigger, thought = EXCLUDED.thought,
    emotion = EXCLUDED.emotion, intensity_before = EXCLUDED.intensity_before,
    intensity_after = EXCLUDED.intensity_after, distortions = EXCLUDED.distortions,
    evidence_for = EXCLUDED.evidence_for, evidence_against = EXCLUDED.evidence_against,
    reframe = EXCLUDED.reframe`;

const RECIPES_SQL = `
  INSERT INTO recipes (id, name, protein_g, calories, ingredients)
  VALUES ($1,$2,$3,$4,$5)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, protein_g = EXCLUDED.protein_g,
    calories = EXCLUDED.calories, ingredients = EXCLUDED.ingredients,
    updated_at = now()`;

async function main() {
  if (!process.env.NOTION_TOKEN) throw new Error('NOTION_TOKEN is not set');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  console.log('Fetching from Notion…');
  console.log(' events:');
  const eventPages = await fetchAll(EVENTS_DS, [
    { property: 'Occurred at', direction: 'ascending' },
  ]);
  console.log(' cbt records:');
  const cbtPages = await fetchAll(CBT_DS, [{ property: 'Date', direction: 'ascending' }]);
  console.log(' recipes:');
  const recipePages = await fetchAll(RECIPES_DS, [{ property: 'Name', direction: 'ascending' }]);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // One transaction for the whole import: either all three tables land or
    // none do, so a failure never leaves a half-migrated store behind.
    await client.query('BEGIN');
    console.log('\nImporting into Postgres…');
    const ev = await importTable(client, 'events', eventPages, eventRow, EVENTS_SQL);
    const lg = await importTable(client, 'legacy_events', eventPages, legacyRow, LEGACY_SQL);
    await importTable(client, 'cbt_records', cbtPages, cbtRow, CBT_SQL);
    await importTable(client, 'recipes', recipePages, recipeRow, RECIPES_SQL);

    // Every page from the event log must have landed in exactly one of the two
    // tables. If it did not, something is being silently dropped — fail loudly
    // rather than commit a lossy migration.
    const accounted = ev.imported + lg.imported;
    if (accounted !== eventPages.length) {
      throw new Error(
        `event log: ${eventPages.length} pages fetched but only ${accounted} stored ` +
          `(${ev.imported} events + ${lg.imported} legacy) — refusing to commit a lossy import`,
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(`\nimport failed: ${e.message}`);
  process.exit(1);
});
