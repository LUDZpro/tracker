import type { CbtDistortion, CbtEmotion } from '@/lib/cbt/types';

/** One source of truth for how the CBT section draws emotions & distortions. */

interface EmotionMeta {
  label: string;
  color: string; // token var
  face: React.ReactNode; // 24×24 stroke body
}

export const EMOTION_META: Record<CbtEmotion, EmotionMeta> = {
  anxious: {
    label: 'Anxious',
    color: 'var(--accent)',
    face: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.2 8.6l2-1M15.8 8.6l-2-1" />
        <path d="M8.5 15.5c1-.9 1.6.9 2.6 0s1.4.9 2.4 0 1.6.9 2 .2" />
        <path d="M9.5 11h.01M14.5 11h.01" />
      </>
    ),
  },
  sad: {
    label: 'Sad',
    color: 'var(--cyan)',
    face: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 16s1.3-1.8 3.5-1.8 3.5 1.8 3.5 1.8" />
        <path d="M9.5 10.5h.01M14.5 10.5h.01" />
      </>
    ),
  },
  angry: {
    label: 'Angry',
    color: 'var(--bad)',
    face: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M7.8 8.8l2.4 1.2M16.2 8.8l-2.4 1.2" />
        <path d="M9 15.5h6" />
        <path d="M9.5 11.5h.01M14.5 11.5h.01" />
      </>
    ),
  },
  ashamed: {
    label: 'Ashamed',
    color: 'var(--warn)',
    face: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 12.5h.01M14.5 12.5h.01" />
        <path d="M10 16h4" />
        <path d="M8 9.5c.8-.5 1.7-.5 2.5-.2M16 9.5c-.8-.5-1.7-.5-2.5-.2" />
      </>
    ),
  },
  guilty: {
    label: 'Guilty',
    color: 'var(--a600)',
    face: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 11.5h.01M14.5 11.5h.01" />
        <path d="M9.5 15.8c1.2-.9 2.3-.9 3.2-.4" />
      </>
    ),
  },
  overwhelmed: {
    label: 'Overwhelmed',
    color: 'var(--a400)',
    face: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.6 10.4l1.8 1.8M10.4 10.4l-1.8 1.8M13.6 10.4l1.8 1.8M15.4 10.4l-1.8 1.8" />
        <circle cx="12" cy="15.7" r="1.3" />
      </>
    ),
  },
  hopeless: {
    label: 'Hopeless',
    color: 'var(--t3)',
    face: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.8 11.6c.4.3 1 .3 1.4 0M13.8 11.6c.4.3 1 .3 1.4 0" />
        <path d="M9 15.8h6" />
      </>
    ),
  },
};

interface DistortionMeta {
  label: string;
  blurb: string; // plain-words one-liner shown on the picker card
  icon: React.ReactNode; // 24×24 stroke body
}

export const DISTORTION_META: Record<CbtDistortion, DistortionMeta> = {
  catastrophizing: {
    label: 'Catastrophizing',
    blurb: 'Jumping to the worst possible outcome',
    icon: (
      <>
        <path d="M17.5 9a4.5 4.5 0 0 0-8.8-1.2A4 4 0 0 0 6 15.6h11a3.5 3.5 0 0 0 .5-6.6Z" />
        <path d="M12 17l-1.5 3.5M11.5 18.5h2.5L12.5 21" />
      </>
    ),
  },
  'all-or-nothing': {
    label: 'All-or-nothing',
    blurb: 'Only total success or total failure, no middle',
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v16" />
        <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" opacity="0.5" />
      </>
    ),
  },
  'mind reading': {
    label: 'Mind reading',
    blurb: 'Assuming you know what others think',
    icon: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h9A2.5 2.5 0 0 1 18 6.5v5a2.5 2.5 0 0 1-2.5 2.5H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 11.5Z" />
        <path d="M8 9h.01M11 9h.01M14 9h.01" />
      </>
    ),
  },
  'fortune telling': {
    label: 'Fortune telling',
    blurb: 'Predicting the future as if it were fact',
    icon: (
      <>
        <circle cx="12" cy="10.5" r="6" />
        <path d="M8 19.5h8M9.5 16.5l-.8 3M14.5 16.5l.8 3" />
        <path d="M9.8 8.6c.5-.9 1.4-1.4 2.4-1.4" />
      </>
    ),
  },
  'emotional reasoning': {
    label: 'Emotional reasoning',
    blurb: '“I feel it, therefore it must be true”',
    icon: (
      <>
        <path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.7 12 20 12 20Z" />
        <path d="M8.5 12h2l1-2 1.5 3.5 1-1.5h1.5" />
      </>
    ),
  },
  overgeneralization: {
    label: 'Overgeneralization',
    blurb: 'One bad moment becomes “always” or “never”',
    icon: (
      <>
        <circle cx="6" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="18" cy="12" r="2" />
        <path d="M8 12h2M14 12h2" />
      </>
    ),
  },
  'mental filter': {
    label: 'Mental filter',
    blurb: 'Seeing only the negatives, filtering the rest out',
    icon: (
      <>
        <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />
      </>
    ),
  },
  'discounting positives': {
    label: 'Discounting positives',
    blurb: '“That good thing doesn’t count”',
    icon: (
      <>
        <path d="M12 3.5l2.4 5 5.6.7-4.1 3.8 1.1 5.5-5-2.8-5 2.8 1.1-5.5L4 9.2l5.6-.7Z" />
        <path d="M4.5 20l15-16" />
      </>
    ),
  },
  'should statements': {
    label: 'Should statements',
    blurb: 'Rigid rules about how you “must” be',
    icon: (
      <>
        <path d="M8 4h8a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2Z" />
        <path d="M9 8.5h6M9 12h6M9 15.5h3" />
        <path d="M15.5 15.2v2.4M15.5 19.4h.01" />
      </>
    ),
  },
  labeling: {
    label: 'Labeling',
    blurb: 'Turning one event into an identity: “I’m a failure”',
    icon: (
      <>
        <path d="M11.6 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.6a2 2 0 0 0 .6 1.4l7.4 7.4a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8L12.9 4a2 2 0 0 0-1.3-.5Z" />
        <circle cx="8" cy="8" r="1.2" />
      </>
    ),
  },
  personalization: {
    label: 'Personalization',
    blurb: 'Making yourself the cause of everything bad',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="10" r="2.2" />
        <path d="M7.5 17.5c.8-2.2 2.5-3.3 4.5-3.3s3.7 1.1 4.5 3.3" />
        <path d="M12 2v1.8M12 20.2V22M2 12h1.8M20.2 12H22" />
      </>
    ),
  },
};

interface IconProps {
  body: React.ReactNode;
  size?: number;
}

export function CbtIcon({ body, size = 22 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {body}
    </svg>
  );
}

/** SUDS color ramp — calm → strained → burning. */
export function sudsColor(value: number): string {
  if (value < 34) return 'var(--ok)';
  if (value < 67) return 'var(--warn)';
  return 'var(--bad)';
}
