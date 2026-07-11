'use client';

import { useCallback, useRef } from 'react';

const HOLD_MS = 500;
const MOVE_TOLERANCE_PX = 12;

/**
 * Long-press detection for log buttons (UX-PATCH-03 pre-log flow).
 * Returns spreadable handlers; wrap the button's own onClick with `guard`
 * so a completed long-press doesn't also fire the tap action.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(30);
        onLongPress();
      }, HOLD_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!origin.current) return;
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const guard = useCallback(
    (onClick: () => void) => () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onClick();
    },
    [],
  );

  return {
    guard,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
