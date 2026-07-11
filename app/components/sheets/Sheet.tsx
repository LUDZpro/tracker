'use client';

import { useRef, useState } from 'react';
import styles from './sheets.module.css';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const DISMISS_DISTANCE = 90;

/** Bottom sheet: slide-up on mount, swipe-down or backdrop tap to cancel. */
export default function Sheet({ title, onClose, children }: Props) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > DISMISS_DISTANCE) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={styles.grabber} aria-hidden />
        <h2 className={styles.sheetTitle}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
