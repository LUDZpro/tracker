/* Design-system page behaviour: scroll spy, copy-to-clipboard, and the few
   live demos (hold wipe, sheet entrance, SUDS dial, balance beam). */

(() => {
  'use strict';

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReducedMotion = () => reducedMotionQuery.matches;

  /* ── compact mobile section navigation ─────────────────────────── */

  const nav = document.querySelector('.ds-nav');
  const sourceLinks = Array.from(document.querySelectorAll('.ds-nav > .ds-navGroup .ds-navLink'));
  if (nav && sourceLinks.length) {
    const mobileSections = document.createElement('div');
    mobileSections.className = 'ds-mobileSections';
    mobileSections.setAttribute('aria-label', 'Page sections');
    sourceLinks.forEach((link) => mobileSections.append(link.cloneNode(true)));
    nav.append(mobileSections);
  }

  /* ── scroll spy ─────────────────────────────────────────────────── */

  const links = Array.from(document.querySelectorAll('.ds-navLink'));
  const sections = Array.from(document.querySelectorAll('.ds-section'));

  const setCurrent = (id) => {
    links.forEach((a) => a.removeAttribute('aria-current'));
    links
      .filter((a) => a.getAttribute('href') === `#${id}`)
      .forEach((a) => a.setAttribute('aria-current', 'true'));
  };

  const spy = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setCurrent(visible.target.id);
    },
    { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
  );
  sections.forEach((s) => spy.observe(s));

  /* ── copy a swatch hex ──────────────────────────────────────────── */

  const toast = document.getElementById('ds-toast');
  const toastMsg = document.getElementById('ds-toastMsg');
  const toastVal = document.getElementById('ds-toastVal');
  let toastTimer = null;

  const flashToast = (message, value = '') => {
    if (!toast || !toastMsg || !toastVal) return;
    toastMsg.textContent = message;
    toastVal.textContent = value;
    toast.classList.add('is-on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1400);
  };

  document.querySelectorAll('.ds-swatch').forEach((button) => {
    button.addEventListener('click', async () => {
      const hex = button.dataset.hex;
      if (!hex) return;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(hex);
        flashToast('Copied', hex);
      } catch {
        flashToast('Copy unavailable', hex);
      }
    });
  });

  /* ── hold-to-log wipe demo ──────────────────────────────────────── */

  const holdBtn = document.getElementById('ds-holdDemo');
  const holdFill = document.getElementById('ds-holdFill');
  if (holdBtn && holdFill) {
    const start = () => {
      holdFill.style.transition = prefersReducedMotion() ? 'none' : 'width 500ms linear';
      holdFill.style.width = '100%';
    };
    const end = () => {
      holdFill.style.transition = prefersReducedMotion() ? 'none' : 'width 150ms ease';
      holdFill.style.width = '0';
    };
    holdBtn.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) =>
      holdBtn.addEventListener(evt, end),
    );
  }

  /* ── flash demo ─────────────────────────────────────────────────── */

  const flashBtn = document.getElementById('ds-flashDemo');
  if (flashBtn) {
    flashBtn.addEventListener('click', () => {
      flashBtn.classList.add('t-flash');
      if (!prefersReducedMotion()) {
        flashBtn.animate(
          [{ filter: 'brightness(1.6)' }, { filter: 'brightness(1)' }],
          { duration: 150, easing: 'cubic-bezier(.16,1,.3,1)' },
        );
      }
      setTimeout(
        () => flashBtn.classList.remove('t-flash'),
        prefersReducedMotion() ? 0 : 400,
      );
    });
  }

  /* ── sheet entrance demo ────────────────────────────────────────── */

  const sheetBtn = document.getElementById('ds-sheetDemo');
  if (sheetBtn) {
    sheetBtn.addEventListener('click', () => {
      const sheet = sheetBtn
        .closest('.ds-section')
        .parentElement.querySelector('.t-sheet');
      if (!sheet) return;
      if (!prefersReducedMotion()) {
        sheet.animate(
          [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
          { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' },
        );
      }
      sheet.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
    });
  }

  /* ── timeline point tooltips (hover, focus, and tap) ───────────── */

  const timelinePoints = Array.from(document.querySelectorAll('button.t-evdot'));
  const closeTimelineTips = (except = null) => {
    timelinePoints.forEach((point) => {
      if (point !== except) point.classList.remove('is-tipOpen');
    });
  };

  timelinePoints.forEach((point) => {
    point.addEventListener('click', () => {
      const willOpen = !point.classList.contains('is-tipOpen');
      closeTimelineTips(point);
      point.classList.remove('is-tipDismissed');
      point.classList.toggle('is-tipOpen', willOpen);
    });
    point.addEventListener('blur', () => {
      point.classList.remove('is-tipOpen', 'is-tipDismissed');
    });
    point.addEventListener('pointerleave', () => {
      if (!point.matches(':focus-visible')) point.classList.remove('is-tipDismissed');
    });
    point.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      point.classList.remove('is-tipOpen');
      point.classList.add('is-tipDismissed');
      point.focus();
    });
  });

  document.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.t-evdot')) {
      closeTimelineTips();
    }
  });

  /* ── SUDS dial ──────────────────────────────────────────────────── */

  const range = document.getElementById('ds-dialRange');
  const fill = document.getElementById('ds-dialFill');
  const num = document.getElementById('ds-dialNum');
  const ARC = Math.PI * 78;

  if (range && fill && num) {
    const sudsColor = (v) => {
      if (v < 34) return 'var(--ok)';
      if (v < 67) return 'var(--warn)';
      return 'var(--bad)';
    };
    const render = () => {
      const v = Number(range.value);
      const color = sudsColor(v);
      fill.setAttribute('stroke-dasharray', `${(v / 100) * ARC} ${ARC}`);
      fill.setAttribute('stroke', color);
      num.setAttribute('fill', color);
      num.textContent = String(v);
    };
    range.addEventListener('input', render);
    render();
  }

  /* ── balance beam ───────────────────────────────────────────────── */

  const beam = document.getElementById('ds-beam');
  if (beam) {
    const MAX_TILT = 11;
    const PER_FACT = 3.5;
    let forCount = 2;
    let againstCount = 5;

    const renderBeam = () => {
      const raw = (againstCount - forCount) * PER_FACT;
      const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, raw));
      beam.style.transform = `rotate(${tilt}deg)`;
      const texts = beam.querySelectorAll('text');
      if (texts[0]) texts[0].textContent = String(forCount);
      if (texts[1]) texts[1].textContent = String(againstCount);
    };

    document.querySelectorAll('[data-beam]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.beam === '1') againstCount = Math.min(9, againstCount + 1);
        else forCount = Math.min(9, forCount + 1);
        if (forCount > 6 && againstCount > 6) {
          forCount = 2;
          againstCount = 5;
        }
        renderBeam();
      });
    });
    renderBeam();
  }
})();
