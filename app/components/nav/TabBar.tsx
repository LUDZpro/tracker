'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './nav.module.css';

const TABS = [
  { href: '/', label: 'Floor', dot: 'var(--sleep)' },
  { href: '/nutrition', label: 'Nutrition', dot: 'var(--intake)' },
  { href: '/gym', label: 'Gym', dot: 'var(--state)' },
] as const;

/** Bottom-fixed tab bar for the three trackers; hidden on the PIN screen. */
export default function TabBar() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <nav className={styles.tabBar} aria-label="Trackers">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={styles.tab}
            aria-current={active ? 'page' : undefined}
          >
            <span
              className={styles.tabDot}
              style={{ '--accent': t.dot } as React.CSSProperties}
              aria-hidden
            />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
