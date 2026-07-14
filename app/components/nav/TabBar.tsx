'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/desktop/presentation';
import styles from './nav.module.css';

const TABS = [
  { href: '/', label: 'Today', icon: 'clock' },
  { href: '/sleep', label: 'Sleep', icon: 'sleep' },
  { href: '/nutrition', label: 'Nutrition', icon: 'meal' },
  { href: '/gym', label: 'Gym', icon: 'gym' },
  { href: '/cbt', label: 'Mind', icon: 'mind' },
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
            <Icon name={t.icon} size={19} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
