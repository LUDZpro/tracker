import assert from 'node:assert/strict';

import {
  durationUncertaintyRange,
  intervalMinutes,
  partOfDayBounds,
  resolveLiveNow,
  resolveWallDateTime,
  shiftZonedDuration,
  validateDurationMinutes,
  validateInstantDraft,
  wallParts,
} from '../datetime-model.mjs';

const ZONE = 'Africa/Casablanca';

let clockValue = new Date('2026-07-29T14:45:00Z');
const injectedClock = () => new Date(clockValue);
const openedNow = resolveLiveNow(injectedClock, ZONE);
clockValue = new Date('2026-07-29T14:52:00Z');
const committedNow = resolveLiveNow(injectedClock, ZONE);
assert.notEqual(
  openedNow.time,
  committedNow.time,
  'live-now resolves from the injected app clock again at commit',
);

const ordinary = resolveWallDateTime('2026-07-29', '14:45', ZONE);
assert.equal(ordinary.status, 'valid', 'ordinary Casablanca wall time resolves once');
assert.deepEqual(
  wallParts(new Date(ordinary.epochMs), ZONE),
  { date: '2026-07-29', time: '14:45' },
  'resolved instant round-trips to the selected wall fields',
);

const repeated = resolveWallDateTime('2026-02-15', '02:30', ZONE);
assert.equal(repeated.status, 'ambiguous', 'repeated Casablanca wall time is not guessed');
assert.equal(repeated.candidates.length, 2, 'both repeated-time offsets remain available');
const earlierRepeat = resolveWallDateTime('2026-02-15', '02:30', ZONE, 'earlier');
const laterRepeat = resolveWallDateTime('2026-02-15', '02:30', ZONE, 'later');
assert.equal(earlierRepeat.status, 'valid', 'earlier repeated-time choice resolves');
assert.equal(laterRepeat.status, 'valid', 'later repeated-time choice resolves');
assert.equal(
  laterRepeat.epochMs - earlierRepeat.epochMs,
  60 * 60 * 1000,
  'the two Casablanca occurrences remain one elapsed hour apart',
);

const missing = resolveWallDateTime('2026-03-22', '02:30', ZONE);
assert.equal(missing.status, 'nonexistent', 'DST-gap wall time is rejected');

const transitionInterval = intervalMinutes({
  startDate: '2026-03-22',
  startTime: '01:30',
  endDate: '2026-03-22',
  endTime: '03:30',
  timeZone: ZONE,
});
assert.deepEqual(
  transitionInterval,
  { status: 'valid', minutes: 60 },
  'elapsed time uses resolved instants across an offset transition',
);

const shifted = shiftZonedDuration({
  date: '2026-03-22',
  time: '01:30',
  minutes: 60,
  timeZone: ZONE,
});
assert.deepEqual(
  shifted,
  { status: 'valid', date: '2026-03-22', time: '03:30' },
  'duration arithmetic returns the correct local endpoint after a clock jump',
);

assert.deepEqual(
  validateInstantDraft(
    { date: '', time: '12:00', precision: 'exact' },
    { currentDate: '2026-07-29', currentTime: '16:00' },
  ),
  { field: 'date', message: 'Choose a complete date.' },
  'missing date targets only the date field',
);

assert.deepEqual(
  validateInstantDraft(
    { date: '2026-07-29', time: '18:00', precision: 'exact' },
    { currentDate: '2026-07-29', currentTime: '16:00' },
  ),
  { field: 'time', message: 'Time can’t be in the future.' },
  'future clock time targets only the time field',
);

assert.deepEqual(
  validateInstantDraft(
    {
      date: '2026-07-29',
      time: '',
      precision: 'part-of-day',
      partOfDay: 'evening',
    },
    { currentDate: '2026-07-29', currentTime: '08:00' },
  ),
  { field: 'part', message: 'That part of today hasn’t started yet.' },
  'a future named period is not treated as midnight',
);

const partCases = [
  ['morning', '04:59', 'future'],
  ['morning', '05:00', 'valid'],
  ['night-start', '20:00', 'future'],
  ['night-start', '21:00', 'valid'],
  ['night-end', '20:00', 'valid'],
];
for (const [partOfDay, currentTime, expected] of partCases) {
  const issue = validateInstantDraft(
    {
      date: '2026-07-29',
      time: '',
      precision: 'part-of-day',
      partOfDay,
    },
    { currentDate: '2026-07-29', currentTime },
  );
  assert.equal(
    issue ? 'future' : 'valid',
    expected,
    `${partOfDay} has an unambiguous boundary at ${currentTime}`,
  );
}

assert.deepEqual(
  partOfDayBounds('night-start', '2026-07-29', ZONE),
  {
    status: 'valid',
    start: { date: '2026-07-29', time: '21:00' },
    end: { date: '2026-07-30', time: '05:00' },
    clippedAtMaximum: false,
  },
  'Tonight is start-date anchored and stores a derived range, not an invented occurrence',
);

const tonightAt22 = resolveWallDateTime('2026-07-29', '22:00', ZONE);
assert.deepEqual(
  partOfDayBounds('night-start', '2026-07-29', ZONE, {
    maxEpochMs: tonightAt22.epochMs,
  }),
  {
    status: 'valid',
    start: { date: '2026-07-29', time: '21:00' },
    end: { date: '2026-07-29', time: '22:00' },
    clippedAtMaximum: true,
  },
  'an active named period never claims that an occurrence could be in the future',
);

const repeatedIssue = validateInstantDraft(
  {
    date: '2026-02-15',
    time: '02:30',
    precision: 'exact',
    timeZone: ZONE,
  },
  { currentDate: '2026-07-29', currentTime: '16:00' },
);
assert.equal(repeatedIssue.field, 'offset', 'repeated time targets an offset choice');
assert.equal(repeatedIssue.candidates.length, 2, 'validation retains both offset candidates');
assert.equal(
  validateInstantDraft(
    {
      date: '2026-02-15',
      time: '02:30',
      precision: 'exact',
      timeZone: ZONE,
      disambiguation: 'earlier',
    },
    { currentDate: '2026-07-29', currentTime: '16:00' },
  ),
  null,
  'choosing the earlier repeated occurrence unblocks validation',
);

assert.deepEqual(
  durationUncertaintyRange(
    458,
    { kind: 'about', toleranceMinutes: 15 },
    { kind: 'exact' },
  ),
  { minMinutes: 443, maxMinutes: 473, toleranceMinutes: 15 },
  'interval duration combines independent boundary uncertainty',
);

assert.deepEqual(
  validateDurationMinutes('1', { min: 5, max: 600, label: 'Gym' }),
  { message: 'Gym must be between 5 minutes and 10 hours.' },
  'duration validation respects the field minimum',
);
assert.deepEqual(
  validateDurationMinutes('0', { min: 1, max: 600, label: 'Nap' }),
  { message: 'Nap must be between 1 minute and 10 hours.' },
  'duration copy uses a singular one-minute bound',
);
assert.equal(
  validateDurationMinutes('65', { min: 5, max: 600, label: 'Gym' }),
  null,
  'valid duration clears the field error',
);

console.log('Datetime model check passed.');
console.log('- IANA-zone round trips and Casablanca transitions are explicit');
console.log('- Field-level and part-of-day validation targets the correct control');
