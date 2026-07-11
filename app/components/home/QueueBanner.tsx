'use client';

import styles from './home.module.css';

export default function QueueBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p className={styles.queueBanner} role="status">
      {count} queued — will sync
    </p>
  );
}
