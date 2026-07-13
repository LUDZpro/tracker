'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/desktop/presentation';
import styles from '@/components/desktop/desktop.module.css';

const LINKS = [
  { href: '/', label: 'Today', icon: 'clock' },
  { href: '/nutrition', label: 'Nutrition', icon: 'meal' },
  { href: '/gym', label: 'Gym', icon: 'gym' },
  { href: '/sleep', label: 'Sleep', icon: 'sleep' },
] as const;

/** Desktop-only left rail (≥1024px); mobile keeps the bottom TabBar. */
export default function Rail() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <nav className={styles.rail} aria-label="Trackers">
      <div className={styles.railMark} title="tracker.">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 17h18" stroke="var(--t4)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M16 4v13" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="17" r="2.6" fill="var(--accent)" />
        </svg>
      </div>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            title={l.label}
            className={`${styles.railBtn} ${active ? styles.railOn : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={l.icon} size={18} />
          </Link>
        );
      })}
    </nav>
  );
}
