'use client';

import { useState } from 'react';
import DistortionGrid from './DistortionGrid';
import EvidenceScale, { type EvidenceSide } from './EvidenceScale';
import IntensityDial from './IntensityDial';
import { CbtIcon, EMOTION_META, sudsColor } from './presentation';
import { postCbtRecord } from '@/lib/client/cbt';
import { toLocalISO } from '@/lib/time';
import {
  CBT_EMOTIONS,
  CBT_TEXT_LIMITS,
  type CbtDistortion,
  type CbtEmotion,
} from '@/lib/cbt/types';
import styles from './cbt.module.css';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const STEPS = ['trigger', 'thought', 'feel', 'traps', 'evidence', 'reframe', 'after'] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLE: Record<Step, string> = {
  trigger: 'What set it off?',
  thought: 'Catch the thought',
  feel: 'How does it feel?',
  traps: 'Any thinking traps?',
  evidence: 'Weigh the evidence',
  reframe: 'A fairer take',
  after: 'Re-rate it',
};

/** Full-screen guided thought record — one question per step, visuals first. */
export default function ThoughtRecordFlow({ onClose, onSaved }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [trigger, setTrigger] = useState('');
  const [thought, setThought] = useState('');
  const [emotion, setEmotion] = useState<CbtEmotion>('anxious');
  const [intensityBefore, setIntensityBefore] = useState(60);
  const [distortions, setDistortions] = useState<CbtDistortion[]>([]);
  const [evidenceFor, setEvidenceFor] = useState<string[]>([]);
  const [evidenceAgainst, setEvidenceAgainst] = useState<string[]>([]);
  const [reframe, setReframe] = useState('');
  const [intensityAfter, setIntensityAfter] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;

  const canAdvance =
    (step !== 'trigger' || trigger.trim().length > 0) &&
    (step !== 'thought' || thought.trim().length > 0) &&
    (step !== 'reframe' || reframe.trim().length > 0);

  const toggleDistortion = (d: CbtDistortion) =>
    setDistortions((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const addEvidence = (side: EvidenceSide, text: string) => {
    if (side === 'for') setEvidenceFor((prev) => [...prev, text]);
    else setEvidenceAgainst((prev) => [...prev, text]);
  };
  const removeEvidence = (side: EvidenceSide, index: number) => {
    const drop = (prev: string[]) => prev.filter((_, i) => i !== index);
    if (side === 'for') setEvidenceFor(drop);
    else setEvidenceAgainst(drop);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await postCbtRecord({
      occurred_at: toLocalISO(new Date()),
      trigger: trigger.trim(),
      thought: thought.trim(),
      emotion,
      intensityBefore,
      distortions,
      evidenceFor,
      evidenceAgainst,
      reframe: reframe.trim(),
      intensityAfter,
    });
    setSaving(false);
    if (res.ok) {
      navigator.vibrate?.(50);
      onSaved();
      onClose();
    } else {
      setError(res.message);
    }
  };

  const delta = intensityBefore - intensityAfter;

  return (
    <div className={styles.flow} role="dialog" aria-modal="true" aria-label="New thought record">
      <header className={styles.flowHeader}>
        <div className={styles.flowProgress} aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={styles.flowDot}
              data-state={i < stepIndex ? 'done' : i === stepIndex ? 'now' : 'todo'}
            />
          ))}
        </div>
        <button className={styles.flowClose} onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <div className={styles.flowBody}>
        <p className={styles.stepCount}>
          {stepIndex + 1} / {STEPS.length}
        </p>
        <h2 className={styles.stepTitle}>{STEP_TITLE[step]}</h2>

        {step === 'trigger' && (
          <>
            <p className={styles.stepHint}>
              The situation, not the interpretation — where were you, what happened?
            </p>
            <textarea
              className={styles.flowTextarea}
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              maxLength={CBT_TEXT_LIMITS.trigger}
              rows={3}
              placeholder="e.g. Lying in bed, replaying a conversation from today"
              autoFocus
            />
          </>
        )}

        {step === 'thought' && (
          <>
            <p className={styles.stepHint}>
              The exact sentence in your head — write it raw, don’t clean it up.
            </p>
            <textarea
              className={styles.flowTextarea}
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              maxLength={CBT_TEXT_LIMITS.thought}
              rows={4}
              placeholder="e.g. If this is real, everything falls apart"
              autoFocus
            />
          </>
        )}

        {step === 'feel' && (
          <>
            <div className={styles.emotionRow} role="group" aria-label="Emotion">
              {CBT_EMOTIONS.map((e) => {
                const meta = EMOTION_META[e];
                return (
                  <button
                    key={e}
                    type="button"
                    className={styles.emotionBtn}
                    aria-pressed={emotion === e}
                    style={{ '--emo': meta.color } as React.CSSProperties}
                    onClick={() => setEmotion(e)}
                  >
                    <CbtIcon body={meta.face} size={26} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <IntensityDial
              value={intensityBefore}
              onChange={setIntensityBefore}
              label="How strong is it right now?"
              hint="0 is fully calm, 100 is the worst it gets"
            />
          </>
        )}

        {step === 'traps' && (
          <>
            <p className={styles.stepHint}>
              Tap any pattern you recognize in the thought. None is a valid answer.
            </p>
            <DistortionGrid selected={distortions} onToggle={toggleDistortion} />
          </>
        )}

        {step === 'evidence' && (
          <>
            <blockquote className={styles.thoughtQuote}>“{thought.trim()}”</blockquote>
            <EvidenceScale
              forItems={evidenceFor}
              againstItems={evidenceAgainst}
              onAdd={addEvidence}
              onRemove={removeEvidence}
            />
          </>
        )}

        {step === 'reframe' && (
          <>
            <blockquote className={styles.thoughtQuote}>“{thought.trim()}”</blockquote>
            <p className={styles.stepHint}>
              Not forced positivity — what would you tell a friend holding these facts?
            </p>
            <textarea
              className={styles.flowTextarea}
              value={reframe}
              onChange={(e) => setReframe(e.target.value)}
              maxLength={CBT_TEXT_LIMITS.reframe}
              rows={4}
              placeholder="e.g. I don’t actually know yet — guessing at 2am isn’t evidence"
              autoFocus
            />
          </>
        )}

        {step === 'after' && (
          <>
            <blockquote className={`${styles.thoughtQuote} ${styles.reframeQuote}`}>
              “{reframe.trim()}”
            </blockquote>
            <IntensityDial
              value={intensityAfter}
              onChange={setIntensityAfter}
              label="Holding the reframe, how strong is the feeling now?"
            />
            <div className={styles.deltaRow} aria-live="polite">
              <span style={{ color: sudsColor(intensityBefore) }}>{intensityBefore}</span>
              <span className={styles.deltaArrow} aria-hidden>
                →
              </span>
              <span style={{ color: sudsColor(intensityAfter) }}>{intensityAfter}</span>
              {delta > 0 && <span className={styles.deltaBadge}>−{delta} pts</span>}
            </div>
          </>
        )}

        {error && <p className="error-inline">{error}</p>}
      </div>

      <footer className={styles.flowFooter}>
        {stepIndex > 0 ? (
          <button className={styles.flowBack} onClick={() => setStepIndex((i) => i - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {last ? (
          <button className={styles.flowNext} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save record'}
          </button>
        ) : (
          <button
            className={styles.flowNext}
            onClick={() => setStepIndex((i) => i + 1)}
            disabled={!canAdvance}
          >
            Next
          </button>
        )}
      </footer>
    </div>
  );
}
