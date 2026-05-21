import { useRef, useState, ReactNode, PointerEvent } from 'react';

interface SwipeableProps {
  /** Pixel width the row reveals when swiped open. */
  revealWidth?: number;
  /** Px of horizontal travel before the gesture is considered a swipe (vs scroll). */
  threshold?: number;
  onDelete: () => void;
  children: ReactNode;
  className?: string;
  /** Class on the visible track (the part that translates). */
  trackClassName?: string;
}

/**
 * Touch/pointer-driven swipe-left-to-reveal-delete primitive.
 * - Drag past `threshold` left to peek the delete button.
 * - Release past 50% of `revealWidth` snaps it open; otherwise snaps closed.
 * - Tap anywhere on an open row closes it (handled by the parent's pointerdown).
 */
export function Swipeable({
  revealWidth = 88,
  threshold = 8,
  onDelete,
  children,
  className,
  trackClassName,
}: SwipeableProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const decided = useRef<'horizontal' | 'vertical' | null>(null);
  const [open, setOpen] = useState(false);

  const apply = (offset: number, instant = false) => {
    const el = trackRef.current;
    if (!el) return;
    if (instant) el.classList.add('is-dragging');
    else el.classList.remove('is-dragging');
    el.style.transform = `translateX(${offset}px)`;
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Ignore non-primary pointers and clicks on the delete button itself
    if ((e.target as HTMLElement).closest('[data-swipe-delete]')) return;
    if (open) {
      // First touch on an open row closes it; don't start a new drag.
      setOpen(false);
      apply(0);
      return;
    }
    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = true;
    decided.current = null;
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (decided.current === null) {
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      decided.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (decided.current === 'horizontal') {
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
      }
    }
    if (decided.current !== 'horizontal') return;
    // Only allow leftward drag; clamp at -revealWidth*1.4 so it has rubber-band feel
    const offset = Math.min(0, Math.max(-revealWidth * 1.4, dx));
    apply(offset, true);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const wasHorizontal = decided.current === 'horizontal';
    decided.current = null;
    startX.current = null;
    startY.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!wasHorizontal) return;
    const el = trackRef.current;
    if (!el) return;
    const m = el.style.transform.match(/translateX\(([-\d.]+)px\)/);
    const offset = m ? parseFloat(m[1]) : 0;
    if (offset < -revealWidth / 2) {
      setOpen(true);
      apply(-revealWidth);
    } else {
      setOpen(false);
      apply(0);
    }
  };

  return (
    <div className={`swipeable ${className ?? ''}`}>
      <button
        type="button"
        data-swipe-delete
        className="swipeable-delete"
        style={{ width: revealWidth }}
        onClick={() => {
          setOpen(false);
          apply(0);
          onDelete();
        }}
        aria-label="Delete"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4h10M5 4V2.5h4V4M3.5 4l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Delete
      </button>
      <div
        ref={trackRef}
        className={`swipeable-track ${trackClassName ?? ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
      </div>
    </div>
  );
}
