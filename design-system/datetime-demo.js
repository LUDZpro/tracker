import {
  durationLabel,
  durationUncertaintyRange,
  intervalMinutes,
  resolveLiveNow,
  resolveWallDateTime,
  shiftWallDate,
  shiftZonedDuration,
  validateDurationMinutes,
  validateInstantDraft,
  wallParts,
} from './datetime-model.mjs';

const DEFAULT_TIME_ZONE = 'Africa/Casablanca';
const MINUTE_MS = 60 * 1000;
const appClock = () => new Date();

const offsetLabel = (offsetMinutes) => {
  const sign = offsetMinutes >= 0 ? '+' : '−';
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
};

const formatDisambiguationSummary = (resolution, choice, prefix = '') => {
  if (
    resolution?.status !== 'ambiguous' ||
    (choice !== 'earlier' && choice !== 'later')
  ) {
    return '';
  }
  const candidate =
    choice === 'earlier'
      ? resolution.candidates[0]
      : resolution.candidates.at(-1);
  const occurrence = choice === 'earlier' ? 'Earlier' : 'Later';
  return `${prefix ? `${prefix} ` : ''}${occurrence} · ${offsetLabel(candidate.offsetMinutes)}`;
};

const updateDisambiguationSelect = (select, group, resolution) => {
  const repeated = resolution.status === 'ambiguous';
  group.hidden = !repeated;
  if (!repeated) {
    select.value = '';
    return;
  }
  const earlier = select.querySelector('option[value="earlier"]');
  const later = select.querySelector('option[value="later"]');
  if (earlier) {
    earlier.textContent = `Earlier · ${offsetLabel(resolution.candidates[0].offsetMinutes)}`;
  }
  if (later) {
    later.textContent = `Later · ${offsetLabel(resolution.candidates.at(-1).offsetMinutes)}`;
  }
};

const dateLabel = (dateKey, todayKey) => {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === shiftWallDate(todayKey, -1)) return 'Yesterday';
  const values = dateKey.split('-').map(Number);
  if (values.length !== 3 || !values.every(Number.isFinite)) return 'Choose a date';
  const [year, month, day] = values;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: year === Number(todayKey.slice(0, 4)) ? undefined : 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

const markPreset = (form, active) => {
  form.querySelectorAll('[data-dt-preset]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button === active));
  });
};

const issueField = (form, field) => {
  const selectors = {
    date: '[data-dt-date]',
    time: '[data-dt-time]',
    part: '[data-dt-part]',
    offset: '[data-dt-offset-group]',
  };
  return selectors[field] ? form.querySelector(selectors[field]) : null;
};

const setInvalid = (form, issue = null) => {
  const error = form.querySelector('[data-dt-error]');
  form.classList.toggle('is-invalid', Boolean(issue));
  form
    .querySelectorAll(
      '[data-dt-date], [data-dt-time], [data-dt-part], [data-dt-offset-group]',
    )
    .forEach((input) => input.removeAttribute('aria-invalid'));
  if (!issue) return;
  issueField(form, issue.field)?.setAttribute('aria-invalid', 'true');
  if (error) error.textContent = issue.message;
};

const focusIssue = (form, issue) => {
  const target = issueField(form, issue.field);
  if (target?.matches('fieldset')) target.querySelector('input, select')?.focus();
  else target?.focus();
};

const initializeInstantDemo = (form) => {
  const timeZone = form.dataset.timeZone || DEFAULT_TIME_ZONE;
  const dateInput = form.querySelector('[data-dt-date]');
  const timeInput = form.querySelector('[data-dt-time]');
  const partInput = form.querySelector('[data-dt-part]');
  const offsetGroup = form.querySelector('[data-dt-offset-group]');
  const offsetInputs = [...form.querySelectorAll('[data-dt-disambiguation]')];
  const summary = form.querySelector('[data-dt-summary]');
  const detail = form.querySelector('[data-dt-summary-detail]');
  const collapsedAnchor = form
    .closest('[data-dt-overlay-root]')
    ?.querySelector('[data-dt-anchor-summary]');

  if (!dateInput || !timeInput || !summary || !detail) return;

  const now = () => resolveLiveNow(appClock, timeZone);
  let liveNow =
    form.querySelector('[data-dt-preset="now"]')?.getAttribute('aria-pressed') === 'true';

  const selectedPrecision = () =>
    form.querySelector('[data-dt-precision]:checked')?.value || 'exact';

  const selectedDisambiguation = () =>
    form.querySelector('[data-dt-disambiguation]:checked')?.value || undefined;

  const syncNowFields = () => {
    const current = now();
    dateInput.value = current.date;
    timeInput.value = current.time;
  };

  const draft = () => ({
    date: dateInput.value,
    time: timeInput.value,
    precision: selectedPrecision(),
    partOfDay: partInput?.value,
    disambiguation: selectedDisambiguation(),
    timeZone,
  });

  const updateRepeatedTimeChoice = () => {
    if (!offsetGroup) return { status: 'invalid' };
    const precision = selectedPrecision();
    const resolution =
      precision === 'part-of-day' || !dateInput.value || !timeInput.value
        ? { status: 'invalid' }
        : resolveWallDateTime(dateInput.value, timeInput.value, timeZone);
    const repeated = resolution.status === 'ambiguous';
    offsetGroup.hidden = !repeated;
    if (!repeated) {
      offsetInputs.forEach((input) => {
        input.checked = false;
      });
      return resolution;
    }
    for (const [index, choice] of ['earlier', 'later'].entries()) {
      const candidate =
        choice === 'earlier'
          ? resolution.candidates[0]
          : resolution.candidates.at(-1);
      const label = offsetGroup.querySelector(`[data-dt-offset-label="${choice}"]`);
      if (label) {
        label.textContent = `${index === 0 ? 'Earlier' : 'Later'} · ${offsetLabel(candidate.offsetMinutes)}`;
      }
    }
    return resolution;
  };

  const validate = () => {
    const current = now();
    dateInput.max = current.date;
    return validateInstantDraft(draft(), {
      currentDate: current.date,
      currentTime: current.time,
    });
  };

  const shouldShowDuringEntry = (issue) => {
    if (!issue) return false;
    const target = issueField(form, issue.field);
    return Boolean(target?.value);
  };

  const render = ({ validationMode = 'entry' } = {}) => {
    const precision = selectedPrecision();
    const current = now();
    form.dataset.precision = precision;
    dateInput.max = current.date;
    const repeatedResolution = updateRepeatedTimeChoice();
    const disambiguationSummary = formatDisambiguationSummary(
      repeatedResolution,
      selectedDisambiguation(),
    );
    const summarize = (value) =>
      disambiguationSummary ? `${value} · ${disambiguationSummary}` : value;

    const label = dateLabel(dateInput.value, current.date);
    if (liveNow && precision === 'exact') {
      summary.textContent = 'Now · resolved when Use this time is pressed';
      detail.textContent = 'Exact occurrence time; the visible draft refreshes on commit';
    } else if (precision === 'part-of-day') {
      const part =
        partInput?.selectedOptions?.[0]?.textContent?.toLowerCase() || 'part of day';
      summary.textContent = `${label} · ${part}`;
      detail.textContent = 'Named local period; no exact minute will be invented';
    } else if (precision === 'about') {
      summary.textContent = summarize(`${label} · about ${timeInput.value || '—'}`);
      detail.textContent = 'Approximate occurrence · within about 15 minutes';
    } else {
      summary.textContent = summarize(`${label} at ${timeInput.value || '—'}`);
      detail.textContent = 'Exact occurrence time';
    }

    if (collapsedAnchor) {
      collapsedAnchor.textContent =
        liveNow && precision === 'exact' ? 'Now' : summary.textContent;
    }
    const issue = validate();
    setInvalid(
      form,
      validationMode === 'submit' || shouldShowDuringEntry(issue) ? issue : null,
    );
  };

  const resolveLiveNowAtCommit = () => {
    if (!liveNow || selectedPrecision() !== 'exact') return;
    syncNowFields();
    liveNow = false;
    markPreset(form, null);
  };

  const commit = () => {
    resolveLiveNowAtCommit();
    render({ validationMode: 'submit' });
    const issue = validate();
    if (issue) {
      focusIssue(form, issue);
      return;
    }
    if (!detail.textContent.includes('ready to save')) {
      detail.textContent = `${detail.textContent} · ready to save`;
    }
    form.dispatchEvent(new CustomEvent('dt:applied', { bubbles: true }));
  };

  form.querySelectorAll('[data-dt-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = now();
      const preset = button.dataset.dtPreset;
      if (preset === 'now') {
        syncNowFields();
        liveNow = true;
      } else if (preset === '15-minutes-ago') {
        const earlier = wallParts(
          new Date(appClock().getTime() - 15 * MINUTE_MS),
          timeZone,
        );
        dateInput.value = earlier.date;
        timeInput.value = earlier.time;
        liveNow = false;
      } else if (preset === 'yesterday') {
        dateInput.value = shiftWallDate(current.date, -1);
        timeInput.value = current.time;
        liveNow = false;
      }
      markPreset(form, button);
      render();
    });
  });

  [dateInput, timeInput, partInput].filter(Boolean).forEach((input) => {
    input.addEventListener('input', () => {
      liveNow = false;
      markPreset(form, null);
      render();
    });
    input.addEventListener('change', () => render());
  });

  form.querySelectorAll('[data-dt-precision]').forEach((input) => {
    input.addEventListener('change', () => {
      if (selectedPrecision() !== 'exact') {
        liveNow = false;
        markPreset(form, null);
      }
      render();
    });
  });

  offsetInputs.forEach((input) => {
    input.addEventListener('change', () => render());
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    commit();
  });

  form.addEventListener('dt:draft-restored', () => {
    liveNow =
      form.querySelector('[data-dt-preset="now"]')?.getAttribute('aria-pressed') ===
      'true';
    render();
  });

  if (liveNow) syncNowFields();
  render();
};

const captureDraft = (form) => ({
  controls: [...form.querySelectorAll('input, select, textarea')].map((control) => ({
    control,
    value: control.value,
    checked: 'checked' in control ? control.checked : undefined,
  })),
  presets: [...form.querySelectorAll('[data-dt-preset]')].map((button) => ({
    button,
    pressed: button.getAttribute('aria-pressed'),
  })),
});

const comparableDraft = (snapshot) =>
  JSON.stringify({
    controls: snapshot.controls.map(({ control, value, checked }) => ({
      name: control.name,
      value,
      checked,
    })),
    presets: snapshot.presets.map(({ button, pressed }) => ({
      preset: button.dataset.dtPreset,
      pressed,
    })),
  });

const restoreDraft = (form, snapshot) => {
  snapshot.controls.forEach(({ control, value, checked }) => {
    control.value = value;
    if (checked !== undefined) control.checked = checked;
  });
  snapshot.presets.forEach(({ button, pressed }) => {
    button.setAttribute('aria-pressed', pressed);
  });
  form.dispatchEvent(new CustomEvent('dt:draft-restored'));
};

const initializeOverlay = (root) => {
  const invoker = root.querySelector('[data-dt-invoker]');
  const overlay = root.querySelector('[data-dt-overlay]');
  const form = overlay?.querySelector('form');
  if (!invoker || !overlay || !form) return;

  const prompt = overlay.querySelector('[data-dt-discard-prompt]');
  const keepButton = prompt?.querySelector('[data-dt-keep]');
  const discardButton = prompt?.querySelector('[data-dt-discard]');
  let openingDraft = captureDraft(form);

  const isDirty = () => comparableDraft(captureDraft(form)) !== comparableDraft(openingDraft);

  const hidePrompt = () => {
    if (prompt) prompt.hidden = true;
  };

  const close = ({ restore = true } = {}) => {
    if (restore) restoreDraft(form, openingDraft);
    hidePrompt();
    overlay.hidden = true;
    invoker.setAttribute('aria-expanded', 'false');
    invoker.focus();
  };

  const showDiscardPrompt = () => {
    if (!prompt) {
      close({ restore: true });
      return;
    }
    prompt.hidden = false;
    keepButton?.focus();
  };

  const requestAccidentalClose = () => {
    if (isDirty()) showDiscardPrompt();
    else close({ restore: true });
  };

  const open = () => {
    openingDraft = captureDraft(form);
    overlay.hidden = false;
    invoker.setAttribute('aria-expanded', 'true');
    hidePrompt();
    form.querySelector('input:not([type="radio"]), select, button')?.focus();
  };

  invoker.addEventListener('click', () => {
    if (overlay.hidden) open();
    else requestAccidentalClose();
  });

  overlay.querySelectorAll('[data-dt-close], [data-dt-cancel]').forEach((button) => {
    button.addEventListener('click', () => close({ restore: true }));
  });

  keepButton?.addEventListener('click', () => {
    hidePrompt();
    form.querySelector('[aria-invalid="true"], input, select')?.focus();
  });
  discardButton?.addEventListener('click', () => close({ restore: true }));

  form.addEventListener('dt:applied', () => {
    openingDraft = captureDraft(form);
    close({ restore: false });
  });

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (prompt && !prompt.hidden) {
        hidePrompt();
        form.querySelector('input, select')?.focus();
      } else {
        requestAccidentalClose();
      }
      return;
    }

    if (event.key !== 'Tab' || !prompt || prompt.hidden) return;
    const focusable = [...prompt.querySelectorAll('button')]
      .filter((element) => !element.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (!overlay.querySelector('.ds-dtPhoneSheet')) {
    overlay.addEventListener('focusout', () => {
      queueMicrotask(() => {
        const active = document.activeElement;
        if (
          overlay.hidden ||
          overlay.contains(active) ||
          active === invoker ||
          active === document.body
        ) {
          return;
        }
        requestAccidentalClose();
      });
    });
    document.addEventListener('click', (event) => {
      if (
        overlay.hidden ||
        overlay.contains(event.target) ||
        invoker.contains(event.target)
      ) {
        return;
      }
      if (isDirty()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showDiscardPrompt();
        return;
      }
      requestAccidentalClose();
    }, true);
  }

  const dragRegion = overlay.querySelector('[data-dt-drag-region]');
  if (dragRegion) {
    let dragActive = false;
    let startY = 0;

    const beginDrag = (event) => {
      if (event.target.closest('button')) return;
      dragActive = true;
      startY = event.clientY;
    };

    const finishDrag = (event) => {
      if (!dragActive) return;
      dragActive = false;
      if (event.clientY - startY >= 72) requestAccidentalClose();
    };

    dragRegion.addEventListener('pointerdown', beginDrag);
    dragRegion.addEventListener('mousedown', (event) => {
      if (!dragActive) beginDrag(event);
    });
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('mouseup', finishDrag);
    document.addEventListener('pointercancel', () => {
      dragActive = false;
    });
  }

  invoker.setAttribute('aria-expanded', String(!overlay.hidden));
};

const setGroupError = (error, inputs, message = '') => {
  error.classList.toggle('is-visible', Boolean(message));
  inputs.forEach((input) => input.removeAttribute('aria-invalid'));
  if (!message) return;
  error.textContent = message;
  inputs.forEach((input) => input.setAttribute('aria-invalid', 'true'));
};

const precisionFrom = (select) =>
  select.value === 'about'
    ? {
        kind: 'about',
        toleranceMinutes: Number(select.dataset.toleranceMinutes || 15),
      }
    : { kind: 'exact' };

const initializeIntervalDemo = (container) => {
  const startDate = container.querySelector('[data-dt-start-date]');
  const startTime = container.querySelector('[data-dt-start-time]');
  const endDate = container.querySelector('[data-dt-end-date]');
  const endTime = container.querySelector('[data-dt-end-time]');
  const startPrecision = container.querySelector('[data-dt-start-precision]');
  const endPrecision = container.querySelector('[data-dt-end-precision]');
  const startOffset = container.querySelector('[data-dt-start-disambiguation]');
  const endOffset = container.querySelector('[data-dt-end-disambiguation]');
  const startOffsetGroup = container.querySelector('[data-dt-start-offset-group]');
  const endOffsetGroup = container.querySelector('[data-dt-end-offset-group]');
  const summary = container.querySelector('[data-dt-interval-summary]');
  const precisionSummary = container.querySelector(
    '[data-dt-interval-precision-summary]',
  );
  const error = container.querySelector('[data-dt-interval-error]');
  const timeZone = container.dataset.timeZone || DEFAULT_TIME_ZONE;
  if (
    !startDate ||
    !startTime ||
    !endDate ||
    !endTime ||
    !startPrecision ||
    !endPrecision ||
    !startOffset ||
    !endOffset ||
    !startOffsetGroup ||
    !endOffsetGroup ||
    !summary ||
    !precisionSummary ||
    !error
  ) {
    return;
  }

  const render = () => {
    precisionSummary.textContent =
      `Start ${startPrecision.value} · end ${endPrecision.value}`;
    const boundaryInputs = [startDate, startTime, endDate, endTime];
    const errorInputs = [...boundaryInputs, startOffset, endOffset];
    const firstMissing = boundaryInputs.find((input) => !input.value);
    if (firstMissing) {
      setGroupError(error, errorInputs, '');
      firstMissing.setAttribute('aria-invalid', 'true');
      error.textContent = 'Enter complete start and end values.';
      error.classList.add('is-visible');
      summary.textContent = 'Check interval';
      return;
    }

    const rawStart = resolveWallDateTime(startDate.value, startTime.value, timeZone);
    const rawEnd = resolveWallDateTime(endDate.value, endTime.value, timeZone);
    updateDisambiguationSelect(startOffset, startOffsetGroup, rawStart);
    updateDisambiguationSelect(endOffset, endOffsetGroup, rawEnd);

    const result = intervalMinutes({
      startDate: startDate.value,
      startTime: startTime.value,
      endDate: endDate.value,
      endTime: endTime.value,
      timeZone,
      startDisambiguation: startOffset.value || undefined,
      endDisambiguation: endOffset.value || undefined,
    });
    let message = '';
    let targets = [endDate, endTime];
    if (result.status === 'reversed') {
      message = 'End must be after start. Choose a later date or time.';
    } else if (result.status === 'nonexistent') {
      message = 'That local time did not occur because the clock changed.';
      targets = result.boundary === 'start' ? [startDate, startTime] : targets;
    } else if (result.status === 'ambiguous') {
      message = 'That local time occurs twice. Choose its earlier or later offset.';
      targets =
        result.boundary === 'start'
          ? [startOffset]
          : [endOffset];
    } else if (result.status !== 'valid') {
      message = 'Enter a real start and end date and time.';
      targets = result.boundary === 'start' ? [startDate, startTime] : targets;
    } else if (result.minutes < 20 || result.minutes > 16 * 60) {
      message = 'Sleep must be between 20 minutes and 16 hours.';
    } else {
      const endResolution = resolveWallDateTime(
        endDate.value,
        endTime.value,
        timeZone,
        endOffset.value || undefined,
      );
      if (
        endResolution.status === 'valid' &&
        endResolution.epochMs > appClock().getTime()
      ) {
        message = 'Sleep end can’t be in the future.';
      }
    }

    setGroupError(error, errorInputs, '');
    setGroupError(error, targets, message);
    if (message) {
      summary.textContent = 'Check interval';
      return;
    }

    const uncertainty = durationUncertaintyRange(
      result.minutes,
      precisionFrom(startPrecision),
      precisionFrom(endPrecision),
    );
    const durationSummary = uncertainty.toleranceMinutes
      ? `about ${durationLabel(result.minutes)} · possible ${durationLabel(uncertainty.minMinutes)}–${durationLabel(uncertainty.maxMinutes)}`
      : durationLabel(result.minutes);
    const offsetSummaries = [
      formatDisambiguationSummary(rawStart, startOffset.value, 'start'),
      formatDisambiguationSummary(rawEnd, endOffset.value, 'end'),
    ].filter(Boolean);
    summary.textContent = [durationSummary, ...offsetSummaries].join(' · ');
  };

  [
    startDate,
    startTime,
    endDate,
    endTime,
    startPrecision,
    endPrecision,
    startOffset,
    endOffset,
  ].forEach((input) => {
    input.addEventListener('input', render);
    input.addEventListener('change', render);
  });
  render();
};

const initializeDurationDemo = (container) => {
  const anchorDate = container.querySelector('[data-dt-anchor-date]');
  const anchorTime = container.querySelector('[data-dt-anchor-time]');
  const anchorOffset = container.querySelector('[data-dt-anchor-disambiguation]');
  const anchorOffsetGroup = container.querySelector('[data-dt-anchor-offset-group]');
  const duration = container.querySelector('[data-dt-duration-minutes]');
  const summary = container.querySelector('[data-dt-duration-summary]');
  const error = container.querySelector('[data-dt-duration-error]');
  const timeZone = container.dataset.timeZone || DEFAULT_TIME_ZONE;
  if (
    !anchorDate ||
    !anchorTime ||
    !anchorOffset ||
    !anchorOffsetGroup ||
    !duration ||
    !summary ||
    !error
  ) {
    return;
  }

  const render = () => {
    [anchorDate, anchorTime, anchorOffset, duration].forEach((input) =>
      input.removeAttribute('aria-invalid'),
    );
    error.classList.remove('is-visible');

    if (!anchorDate.value || !anchorTime.value) {
      const target = !anchorDate.value ? anchorDate : anchorTime;
      target.setAttribute('aria-invalid', 'true');
      error.textContent = 'Enter a complete anchor date and time.';
      error.classList.add('is-visible');
      summary.textContent = 'Check date and time';
      return;
    }

    const rawAnchor = resolveWallDateTime(
      anchorDate.value,
      anchorTime.value,
      timeZone,
    );
    updateDisambiguationSelect(anchorOffset, anchorOffsetGroup, rawAnchor);

    const durationIssue = validateDurationMinutes(duration.value, {
      min: Number(duration.min),
      max: Number(duration.max),
      label: container.dataset.dtDurationLabel || 'Duration',
    });
    if (durationIssue) {
      duration.setAttribute('aria-invalid', 'true');
      error.textContent = durationIssue.message;
      error.classList.add('is-visible');
      summary.textContent = 'Check duration';
      return;
    }

    const minutes = Number(duration.value);
    const direction = container.dataset.dtAnchor === 'start' ? minutes : -minutes;
    const anchorResolution = resolveWallDateTime(
      anchorDate.value,
      anchorTime.value,
      timeZone,
      anchorOffset.value || undefined,
    );
    if (anchorResolution.status !== 'valid') {
      const target =
        anchorResolution.status === 'ambiguous' ? anchorOffset : anchorTime;
      target.setAttribute('aria-invalid', 'true');
      error.textContent =
        anchorResolution.status === 'ambiguous'
          ? 'That local time occurs twice. Choose its earlier or later offset.'
          : 'That local time did not occur because the clock changed.';
      error.classList.add('is-visible');
      summary.textContent = 'Check date and time';
      return;
    }

    const startEpoch =
      container.dataset.dtAnchor === 'start'
        ? anchorResolution.epochMs
        : anchorResolution.epochMs - minutes * MINUTE_MS;
    const endEpoch =
      container.dataset.dtAnchor === 'start'
        ? anchorResolution.epochMs + minutes * MINUTE_MS
        : anchorResolution.epochMs;
    if (endEpoch > appClock().getTime()) {
      anchorTime.setAttribute('aria-invalid', 'true');
      error.textContent = 'Session end can’t be in the future.';
      error.classList.add('is-visible');
      summary.textContent = 'Check date and time';
      return;
    }
    if (startEpoch >= endEpoch) {
      duration.setAttribute('aria-invalid', 'true');
      error.textContent = 'Duration must create a real start and end.';
      error.classList.add('is-visible');
      summary.textContent = 'Check duration';
      return;
    }

    const other = shiftZonedDuration({
      date: anchorDate.value,
      time: anchorTime.value,
      minutes: direction,
      timeZone,
      disambiguation: anchorOffset.value || undefined,
    });
    if (other.status !== 'valid') {
      anchorTime.setAttribute('aria-invalid', 'true');
      error.textContent =
        other.status === 'ambiguous'
          ? 'That local time occurs twice. Choose its earlier or later offset.'
          : 'That local time did not occur because the clock changed.';
      error.classList.add('is-visible');
      summary.textContent = 'Check date and time';
      return;
    }

    const anchorWall = { date: anchorDate.value, time: anchorTime.value };
    const start = container.dataset.dtAnchor === 'start' ? anchorWall : other;
    const end = container.dataset.dtAnchor === 'start' ? other : anchorWall;
    const crossesDate = start.date !== end.date;
    const startText = crossesDate
      ? `${dateLabel(start.date, anchorDate.value)} ${start.time}`
      : start.time;
    const endText = crossesDate
      ? `${dateLabel(end.date, anchorDate.value)} ${end.time}`
      : end.time;
    const offsetSummary = formatDisambiguationSummary(
      rawAnchor,
      anchorOffset.value,
      'anchor',
    );
    summary.textContent = [
      `${startText} → ${endText} · ${durationLabel(minutes)}`,
      offsetSummary,
    ].filter(Boolean).join(' · ');
  };

  [anchorDate, anchorTime, anchorOffset, duration].forEach((input) => {
    input.addEventListener('input', render);
    input.addEventListener('change', render);
  });
  render();
};

document.querySelectorAll('[data-dt-demo]').forEach(initializeInstantDemo);
document.querySelectorAll('[data-dt-overlay-root]').forEach(initializeOverlay);
document.querySelectorAll('[data-dt-interval]').forEach(initializeIntervalDemo);
document.querySelectorAll('[data-dt-duration]').forEach(initializeDurationDemo);
