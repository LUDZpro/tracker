const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const formatterCache = new Map();

const pad = (value) => String(value).padStart(2, '0');

const formatterFor = (timeZone) => {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    );
  }
  return formatterCache.get(timeZone);
};

const parseWallFields = (dateKey, timeValue) => {
  const dateMatch = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const values = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
  if (values.hour > 23 || values.minute > 59) return null;

  const ordinal = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
  );
  const check = new Date(ordinal);
  if (
    check.getUTCFullYear() !== values.year ||
    check.getUTCMonth() + 1 !== values.month ||
    check.getUTCDate() !== values.day
  ) {
    return null;
  }

  return { ...values, ordinal };
};

const offsetMinutesAt = (epochMs, timeZone) => {
  const wall = wallParts(new Date(epochMs), timeZone);
  const parsed = parseWallFields(wall.date, wall.time);
  const instantAtMinute = Math.floor(epochMs / MINUTE_MS) * MINUTE_MS;
  return (parsed.ordinal - instantAtMinute) / MINUTE_MS;
};

const sameWallFields = (epochMs, dateKey, timeValue, timeZone) => {
  const wall = wallParts(new Date(epochMs), timeZone);
  return wall.date === dateKey && wall.time === timeValue;
};

export const wallParts = (date, timeZone) => {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

export const resolveLiveNow = (clock, timeZone) => ({
  ...wallParts(clock(), timeZone),
  precision: 'exact',
});

export const resolveWallDateTime = (
  dateKey,
  timeValue,
  timeZone,
  disambiguation = 'reject',
) => {
  const parsed = parseWallFields(dateKey, timeValue);
  if (!parsed) return { status: 'invalid' };

  const offsets = new Set();
  for (let hours = -48; hours <= 48; hours += 6) {
    offsets.add(offsetMinutesAt(parsed.ordinal + hours * HOUR_MS, timeZone));
  }

  const candidates = [...offsets]
    .map((offsetMinutes) => ({
      epochMs: parsed.ordinal - offsetMinutes * MINUTE_MS,
      offsetMinutes,
    }))
    .filter(({ epochMs }) => sameWallFields(epochMs, dateKey, timeValue, timeZone))
    .filter(
      (candidate, index, all) =>
        all.findIndex(({ epochMs }) => epochMs === candidate.epochMs) === index,
    )
    .sort((left, right) => left.epochMs - right.epochMs);

  if (!candidates.length) return { status: 'nonexistent' };
  if (candidates.length > 1) {
    if (disambiguation === 'earlier' || disambiguation === 'later') {
      const selected =
        disambiguation === 'earlier' ? candidates[0] : candidates.at(-1);
      return { status: 'valid', ...selected, disambiguation };
    }
    return { status: 'ambiguous', candidates };
  }
  return { status: 'valid', ...candidates[0] };
};

export const intervalMinutes = ({
  startDate,
  startTime,
  endDate,
  endTime,
  timeZone,
  startDisambiguation,
  endDisambiguation,
}) => {
  const start = resolveWallDateTime(
    startDate,
    startTime,
    timeZone,
    startDisambiguation,
  );
  if (start.status !== 'valid') return { status: start.status, boundary: 'start' };
  const end = resolveWallDateTime(endDate, endTime, timeZone, endDisambiguation);
  if (end.status !== 'valid') return { status: end.status, boundary: 'end' };
  if (end.epochMs <= start.epochMs) return { status: 'reversed' };
  return {
    status: 'valid',
    minutes: Math.round((end.epochMs - start.epochMs) / MINUTE_MS),
  };
};

export const shiftZonedDuration = ({
  date,
  time,
  minutes,
  timeZone,
  disambiguation,
}) => {
  const anchor = resolveWallDateTime(date, time, timeZone, disambiguation);
  if (anchor.status !== 'valid') return { status: anchor.status };
  const endpoint = wallParts(new Date(anchor.epochMs + minutes * MINUTE_MS), timeZone);
  return { status: 'valid', ...endpoint };
};

const partOfDayDefinitions = {
  morning: {
    start: { days: 0, time: '05:00' },
    end: { days: 0, time: '12:00' },
  },
  afternoon: {
    start: { days: 0, time: '12:00' },
    end: { days: 0, time: '17:00' },
  },
  evening: {
    start: { days: 0, time: '17:00' },
    end: { days: 0, time: '21:00' },
  },
  'night-end': {
    start: { days: -1, time: '21:00' },
    end: { days: 0, time: '05:00' },
  },
  'night-start': {
    start: { days: 0, time: '21:00' },
    end: { days: 1, time: '05:00' },
  },
};

const minuteOfDay = (timeValue) => {
  const parsed = parseWallFields('2000-01-01', timeValue);
  return parsed ? parsed.hour * 60 + parsed.minute : null;
};

export const validateInstantDraft = (
  { date, time, precision, partOfDay, timeZone, disambiguation },
  { currentDate, currentTime, allowFuture = false },
) => {
  if (!date) return { field: 'date', message: 'Choose a complete date.' };
  if (!parseWallFields(date, '00:00')) {
    return { field: 'date', message: 'Enter a real calendar date.' };
  }
  if (!allowFuture && date > currentDate) {
    return { field: 'date', message: 'Date can’t be in the future.' };
  }

  if (precision === 'part-of-day') {
    const definition = partOfDayDefinitions[partOfDay];
    if (!definition) return { field: 'part', message: 'Choose a part of day.' };
    if (!allowFuture && date === currentDate) {
      const currentMinute = minuteOfDay(currentTime);
      const beginsToday = definition.start.days === 0;
      const startMinute = minuteOfDay(definition.start.time);
      if (beginsToday && startMinute > currentMinute) {
        return { field: 'part', message: 'That part of today hasn’t started yet.' };
      }
    }
    return null;
  }

  if (!time) {
    return { field: 'time', message: 'Enter a complete time, for example 14:45.' };
  }
  const selectedMinute = minuteOfDay(time);
  if (selectedMinute === null) {
    return { field: 'time', message: 'Enter a time from 00:00 to 23:59.' };
  }
  if (
    !allowFuture &&
    date === currentDate &&
    selectedMinute > minuteOfDay(currentTime)
  ) {
    return { field: 'time', message: 'Time can’t be in the future.' };
  }

  if (timeZone) {
    const resolved = resolveWallDateTime(date, time, timeZone, disambiguation);
    if (resolved.status === 'nonexistent') {
      return {
        field: 'time',
        message: 'That local time did not occur because the clock changed.',
      };
    }
    if (resolved.status === 'ambiguous') {
      return {
        field: 'offset',
        message: 'That time occurs twice. Choose the earlier or later offset.',
        candidates: resolved.candidates,
      };
    }
  }
  return null;
};

export const validateDurationMinutes = (value, { min, max, label }) => {
  if (value === '' || !Number.isFinite(Number(value))) {
    return { message: `Enter ${label.toLowerCase()} duration in minutes.` };
  }
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < min || minutes > max) {
    const minimum = `${min} minute${min === 1 ? '' : 's'}`;
    return {
      message: `${label} must be between ${minimum} and ${durationLabel(max)}.`,
    };
  }
  return null;
};

export const durationUncertaintyRange = (
  nominalMinutes,
  startPrecision,
  endPrecision,
) => {
  const tolerance = (precision) =>
    precision?.kind === 'about' ? precision.toleranceMinutes : 0;
  const toleranceMinutes = tolerance(startPrecision) + tolerance(endPrecision);
  return {
    minMinutes: Math.max(0, nominalMinutes - toleranceMinutes),
    maxMinutes: nominalMinutes + toleranceMinutes,
    toleranceMinutes,
  };
};

export const durationLabel = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours} h ${remainder} min`;
};

export const shiftWallDate = (dateKey, days) => {
  const parsed = parseWallFields(dateKey, '12:00');
  if (!parsed) return '';
  const shifted = new Date(parsed.ordinal + days * 24 * HOUR_MS);
  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
  ].join('-');
};

export const partOfDayBounds = (
  partOfDay,
  dateKey,
  timeZone,
  { maxEpochMs } = {},
) => {
  const definition = partOfDayDefinitions[partOfDay];
  if (!definition) return { status: 'invalid' };
  const start = {
    date: shiftWallDate(dateKey, definition.start.days),
    time: definition.start.time,
  };
  const end = {
    date: shiftWallDate(dateKey, definition.end.days),
    time: definition.end.time,
  };
  const startResolution = resolveWallDateTime(start.date, start.time, timeZone);
  const endResolution = resolveWallDateTime(end.date, end.time, timeZone);
  if (startResolution.status !== 'valid') {
    return { status: startResolution.status, boundary: 'start' };
  }
  if (endResolution.status !== 'valid') {
    return { status: endResolution.status, boundary: 'end' };
  }
  if (Number.isFinite(maxEpochMs)) {
    if (maxEpochMs < startResolution.epochMs) return { status: 'future' };
    if (maxEpochMs < endResolution.epochMs) {
      return {
        status: 'valid',
        start,
        end: wallParts(new Date(maxEpochMs), timeZone),
        clippedAtMaximum: true,
      };
    }
  }
  return { status: 'valid', start, end, clippedAtMaximum: false };
};
