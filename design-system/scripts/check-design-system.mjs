import { access, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import './check-datetime-model.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DESIGN_DIR = resolve(SCRIPT_DIR, '..');
const REPO_DIR = resolve(DESIGN_DIR, '..');

const failures = [];
const requiredFiles = [
  'index.html',
  'components.html',
  'DATETIME_INPUTS.md',
  'SNOOKER_TRAINING.md',
  'NEW_TRACKER_SPEC.md',
  'CONFORMANCE.md',
  'RESEARCH.md',
  'README.md',
  'app.js',
  'datetime-demo.js',
  'datetime-model.mjs',
  'server.mjs',
  'styles/tokens.css',
  'styles/components.css',
  'styles/docs.css',
  'styles/handbook.css',
  'styles/datetime.css',
  'scripts/check-datetime-model.mjs',
];

const readText = (path) => readFile(path, 'utf8');
const normalizeNewlines = (value) => value.replaceAll('\r\n', '\n');
const stripHtmlComments = (value) => value.replaceAll(/<!--[\s\S]*?-->/g, '');
const visibleText = (html) =>
  html
    .replaceAll(/<svg[\s\S]*?<\/svg>/g, '')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const validateTagBalance = (file, html) => {
  const stack = [];
  const tags = Array.from(html.matchAll(/<\/?([a-z][\w:-]*)(?:\s[^<>]*?)?\/?>/gi));

  for (const match of tags) {
    const token = match[0];
    const tag = match[1].toLowerCase();
    if (voidTags.has(tag) || token.startsWith('<!')) continue;
    if (token.endsWith('/>')) {
      const inForeignContent = stack.includes('svg') || stack.includes('math');
      if (inForeignContent || tag === 'svg' || tag === 'math') continue;
      failures.push(`Invalid self-closing HTML element in ${file}: <${tag}/>`);
      return;
    }

    if (token.startsWith('</')) {
      const opened = stack.pop();
      if (opened !== tag) {
        failures.push(`Unbalanced HTML in ${file}: expected </${opened || 'none'}>, found </${tag}>`);
        return;
      }
    } else {
      stack.push(tag);
    }
  }

  if (stack.length) failures.push(`Unclosed HTML tag in ${file}: <${stack.at(-1)}>`);
};

for (const file of requiredFiles) {
  try {
    await access(resolve(DESIGN_DIR, file));
  } catch {
    failures.push(`Missing required file: design-system/${file}`);
  }
}

const appTokens = normalizeNewlines(await readText(resolve(REPO_DIR, 'app/styles/tokens.css')));
const catalogTokens = normalizeNewlines(await readText(resolve(DESIGN_DIR, 'styles/tokens.css')));
if (appTokens !== catalogTokens) {
  failures.push('Token drift: styles/tokens.css must exactly mirror app/styles/tokens.css');
}
const docsChrome = await readText(resolve(DESIGN_DIR, 'styles/docs.css'));
const handbookChrome = await readText(resolve(DESIGN_DIR, 'styles/handbook.css'));
if (/(?:^|[;{])\s*color:\s*var\(--t[345]\)/m.test(`${docsChrome}\n${handbookChrome}`)) {
  failures.push('Documentation chrome uses a low-contrast text token (--t3, --t4, or --t5)');
}
const componentStyles = await readText(resolve(DESIGN_DIR, 'styles/components.css'));
const dateTimeStyles = await readText(resolve(DESIGN_DIR, 'styles/datetime.css'));
const dateTimeContract = await readText(resolve(DESIGN_DIR, 'DATETIME_INPUTS.md'));
const snookerContract = await readText(resolve(DESIGN_DIR, 'SNOOKER_TRAINING.md'));
const behaviorSource = await readText(resolve(DESIGN_DIR, 'app.js'));
const dateTimeBehaviorSource = await readText(resolve(DESIGN_DIR, 'datetime-demo.js'));
if (
  !handbookChrome.includes('@media (prefers-reduced-motion: reduce)') ||
  !handbookChrome.includes('.ds-handbook *') ||
  !handbookChrome.includes('.ds-catalog *') ||
  !behaviorSource.includes("matchMedia('(prefers-reduced-motion: reduce)')")
) {
  failures.push('Reduced-motion coverage must include both documentation pages and scripted demos');
}

const tokenSource = appTokens.replaceAll(/\/\*[\s\S]*?\*\//g, '');
const colorEntries = Array.from(
  tokenSource.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi),
  (match) => [
    match[1],
    match[2],
  ],
);
const colorCounts = new Map();
for (const [name] of colorEntries) colorCounts.set(name, (colorCounts.get(name) || 0) + 1);
for (const [name, count] of colorCounts) {
  if (count > 1) failures.push(`Duplicate color-token declaration: --${name}`);
}
const tokenColors = new Map(colorEntries);
const relativeLuminance = (hex) => {
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (left, right) => {
  const light = Math.max(relativeLuminance(left), relativeLuminance(right));
  const dark = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (light + 0.05) / (dark + 0.05);
};
const surfaceTokens = ['canvas', 'night', 'app', 'sheet', 'surface-raised'];
const contrastTokens = ['t1', 't2', ...surfaceTokens];
for (const token of contrastTokens) {
  if (!tokenColors.has(token)) failures.push(`Missing contrast token: --${token}`);
}
const minimumContrast = (textToken) =>
  Math.min(
    ...surfaceTokens.map((surfaceToken) =>
      contrast(tokenColors.get(textToken), tokenColors.get(surfaceToken)),
    ),
  );
const contrastFloors = new Map();
if (contrastTokens.every((token) => tokenColors.has(token))) {
  for (const textToken of ['t1', 't2']) {
    const floor = minimumContrast(textToken);
    contrastFloors.set(textToken, floor);
    if (floor < 4.5) {
      failures.push(`Contrast regression: --${textToken} falls below 4.5:1 on an app surface`);
    }
  }
}

const documents = new Map();
for (const file of ['index.html', 'components.html']) {
  documents.set(file, stripHtmlComments(await readText(resolve(DESIGN_DIR, file))));
}
for (const [file, html] of documents) {
  if (/style="[^"]*color:\s*var\(--t[345]\)[^"]*"/i.test(html)) {
    failures.push(`Inline documentation text uses a low-contrast token in ${file}`);
  }
}

const canonicalOrder = ['Today', 'Sleep', 'Nutrition', 'Gym', 'Mind'];
const requireExactNavigation = (description, labels) => {
  const matches =
    labels.length === canonicalOrder.length &&
    labels.every((label, index) => label === canonicalOrder[index]);
  if (!matches) {
    failures.push(`${description} must be exactly: ${canonicalOrder.join(' / ')}; found: ${labels.join(' / ') || 'none'}`);
  }
};
const manual = documents.get('index.html');
const routeStrip = manual.match(/<div class="ds-routeStrip"[\s\S]*?<\/div>/)?.[0] || '';
const routeLabels = Array.from(
  routeStrip.matchAll(/<span[^>]*>\s*<b[^>]*>[^<]*<\/b>\s*([^<]+)<\/span>/g),
  (match) => match[1].trim(),
);
requireExactNavigation('Manual canonical navigation', routeLabels);

const catalog = documents.get('components.html');
const tabSpecs = Array.from(
  catalog.matchAll(/<nav class="t-tabBar"[^>]*>[\s\S]*?<\/nav>/g),
  (match) => match[0],
);
if (!tabSpecs.length) failures.push('Component catalog has no mobile tab-bar specimen');
for (const [index, tabSpec] of tabSpecs.entries()) {
  const labels = Array.from(
    tabSpec.matchAll(/<(?:a|span)\s+class="t-tab(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/(?:a|span)>/g),
    (match) => visibleText(match[1]),
  );
  requireExactNavigation(`Component catalog tab bar ${index + 1}`, labels);
}

const railSpecs = Array.from(
  catalog.matchAll(/<div class="t-rail"(?:\s[^>]*)?>[\s\S]*?<\/div>/g),
  (match) => match[0],
);
if (!railSpecs.length) failures.push('Component catalog has no desktop rail specimen');
for (const [index, railSpec] of railSpecs.entries()) {
  const labels = Array.from(
    railSpec.matchAll(/class="t-railBtn[^"]*"[^>]*\saria-label="([^"]+)"/g),
    (match) => match[1].trim(),
  );
  requireExactNavigation(`Component catalog rail ${index + 1}`, labels);
}

const timelineButtons = Array.from(
  catalog.matchAll(/<button class="[^"]*\bt-evdot\b[^"]*"[^>]*>[\s\S]*?<\/button>/g),
  (match) => match[0],
);
for (const [index, button] of timelineButtons.entries()) {
  if (!/\saria-label="[^"]+"/.test(button) || !/class="t-tip"/.test(button)) {
    failures.push(`Timeline event button ${index + 1} needs an accessible name and visible tooltip`);
  }
}
const timelineRule = componentStyles.match(/\.t-evdot\s*\{[\s\S]*?\}/)?.[0] || '';
if (!/width:\s*48px/.test(timelineRule) || !/height:\s*48px/.test(timelineRule)) {
  failures.push('Timeline event buttons must keep 48px hit regions');
}
if (
  !behaviorSource.includes("classList.toggle('is-tipOpen'") ||
  !behaviorSource.includes("classList.add('is-tipDismissed'") ||
  !componentStyles.includes(':focus-visible:not(.is-tipDismissed)')
) {
  failures.push('Timeline tooltips need tap/click state and Escape dismissal without moving focus');
}

const staleClaims = [
  'same four destinations',
  'app has no emoji anywhere',
  'Same contract on both surfaces',
];
for (const claim of staleClaims) {
  if (catalog.toLowerCase().includes(claim.toLowerCase())) {
    failures.push(`Stale catalog claim remains: ${claim}`);
  }
}

for (const [file, html] of documents) {
  validateTagBalance(file, html);
  const ids = Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) failures.push(`Duplicate HTML id found in ${file}`);
  const idReferences = Array.from(
    html.matchAll(/\saria-(?:describedby|labelledby)="([^"]+)"/g),
    (match) => match[1].trim().split(/\s+/),
  ).flat();
  for (const idReference of idReferences) {
    if (!idSet.has(idReference)) {
      failures.push(`Broken ARIA id reference in ${file}: ${idReference}`);
    }
  }

  const hrefs = Array.from(html.matchAll(/\shref="([^"]+)"/g), (match) => match[1]);
  for (const href of hrefs) {
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(href)) continue;
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) {
      failures.push(`Unsupported link scheme in ${file}: ${href}`);
      continue;
    }

    const localUrl = new URL(href, `http://design.local/${file}`);
    const targetPath = resolve(DESIGN_DIR, `.${decodeURIComponent(localUrl.pathname)}`);
    const targetRelative = relative(DESIGN_DIR, targetPath);
    if (targetRelative === '..' || targetRelative.startsWith(`..${sep}`)) {
      failures.push(`Local link escapes design-system in ${file}: ${href}`);
      continue;
    }

    try {
      await access(targetPath);
    } catch {
      failures.push(`Broken local link in ${file}: ${href}`);
      continue;
    }

    const fragment = decodeURIComponent(localUrl.hash.slice(1));
    if (fragment && extname(targetPath) === '.html') {
      const targetHtml = stripHtmlComments(await readText(targetPath));
      const targetIds = new Set(
        Array.from(targetHtml.matchAll(/\sid="([^"]+)"/g), (match) => match[1]),
      );
      if (!targetIds.has(fragment)) failures.push(`Broken fragment in ${file}: ${href}`);
    }
  }
}

const dateTimeRequirements = [
  ['mobile date/time sheet specimen', 'ds-dtPhoneSheet'],
  ['desktop date/time popover specimen', 'ds-dtPopover'],
  ['mobile date/time invoker', 'data-dt-invoker'],
  ['open and closed overlay state', 'data-dt-overlay'],
  ['explicit close action', 'data-dt-close'],
  ['explicit cancel action', 'data-dt-cancel'],
  ['handle-only mobile dismissal region', 'data-dt-drag-region'],
  ['repeated-time disambiguation control', 'data-dt-disambiguation'],
  ['direct date input', 'data-dt-date'],
  ['direct time input', 'data-dt-time'],
  ['precision choice', 'data-dt-precision'],
  ['interval specimen', 'data-dt-interval'],
  ['independent interval precision binding', 'data-dt-start-precision'],
  ['interval precision summary binding', 'data-dt-interval-precision-summary'],
  ['duration specimen', 'data-dt-duration'],
  ['legacy wheel warning', 'Current legacy debt — do not copy the looping wheel'],
  ['date/time demo script', 'datetime-demo.js'],
];
for (const [description, marker] of dateTimeRequirements) {
  if (!catalog.includes(marker)) failures.push(`Component catalog is missing ${description}`);
}
for (const marker of [
  'x-snookerLive',
  'x-snookerReview',
  'Record miss',
  'New comparable best',
  'SNOOKER_TRAINING.md',
]) {
  if (!catalog.includes(marker)) {
    failures.push(`Component catalog is missing Snooker specimen marker: ${marker}`);
  }
}
if (!componentStyles.includes('.x-snookerPrimaryActions button')) {
  failures.push('Snooker table-mode specimen is missing ordinary 48px result controls');
}
if (!dateTimeStyles.includes('min-height: 48px')) {
  failures.push('Date/time specimens must keep 48px minimum control targets');
}
if (
  /\.ds-dtDecision\s+a\s*\{[^}]*min-height:\s*(?:3[0-9]|4[0-7])px/s.test(dateTimeStyles)
) {
  failures.push('Date/time contract links must not shrink below the 48px target at any breakpoint');
}
if (
  !dateTimeStyles.includes('touch-action: pan-y') ||
  !dateTimeStyles.includes('overscroll-behavior: contain')
) {
  failures.push('Mobile date/time specimen must own vertical scrolling without sheet dismissal');
}
if (
  !dateTimeBehaviorSource.includes("querySelectorAll('[data-dt-demo]'") ||
  !dateTimeBehaviorSource.includes('initializeOverlay') ||
  !dateTimeBehaviorSource.includes('resolveLiveNow') ||
  !dateTimeBehaviorSource.includes('formatDisambiguationSummary') ||
  !dateTimeBehaviorSource.includes('data-dt-drag-region') ||
  !dateTimeBehaviorSource.includes("querySelectorAll('input, select, textarea')") ||
  !dateTimeBehaviorSource.includes('event.stopImmediatePropagation()')
) {
  failures.push('Date/time demo behavior must cover live fields, offset summaries, safe draft snapshots, commit-time Now, and protected overlay dismissal');
}
if (!catalog.includes('<script type="module" src="datetime-demo.js"></script>')) {
  failures.push('Date/time behavior must load as a module so it can share tested temporal helpers');
}
if (
  !dateTimeContract.includes('occurredPeriod') ||
  !dateTimeContract.includes("'night-end'") ||
  !dateTimeContract.includes("'night-start'") ||
  !dateTimeContract.includes('there is no fabricated representative minute')
) {
  failures.push('Date/time contract must preserve truthful part-of-day and night semantics');
}
for (const marker of [
  'configurationFingerprint',
  'server-derived projection',
  'type ScoringDefinition',
  'scoringSnapshot',
  'start: TrainingBoundary',
  'If-Match',
  'If-Match: <runRevision>',
  'SELECT … FOR UPDATE',
  'clientTag',
  'Start snooker training',
  'Record miss',
  'Persistence boundary',
]) {
  if (!snookerContract.includes(marker)) {
    failures.push(`Snooker training contract is missing required marker: ${marker}`);
  }
}
for (const marker of [
  'Long pots · block 2',
  '38 / 62',
]) {
  if (!catalog.includes(marker)) {
    failures.push(`Snooker specimen is missing comparable metric copy: ${marker}`);
  }
}

const requiredManualSections = [
  'contract',
  'lifecycle',
  'tracker-model',
  'navigation',
  'capture',
  'datetime',
  'states',
  'reflection',
  'accessibility',
  'privacy',
  'delivery',
  'governance',
];
for (const id of requiredManualSections) {
  if (!manual.includes(`id="${id}"`)) failures.push(`Technical manual is missing section #${id}`);
}

if (failures.length) {
  console.error(`Design-system check failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Design-system check passed.');
  console.log(`- ${requiredFiles.length} required files present`);
  console.log('- Application tokens match exactly');
  console.log('- Documentation chrome uses contrast-safe text roles');
  if (contrastFloors.size) {
    console.log(
      `- Contrast floors: --t1 ${contrastFloors.get('t1').toFixed(2)}:1; --t2 ${contrastFloors.get('t2').toFixed(2)}:1`,
    );
  }
  console.log('- Canonical navigation: Today / Sleep / Nutrition / Gym / Mind');
  console.log('- Local links and section anchors resolve');
}
