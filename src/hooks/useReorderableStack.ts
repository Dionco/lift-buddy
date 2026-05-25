import { useCallback, useEffect, useRef, useState } from 'react';

interface UseReorderableStackOpts {
  /** Number of cards in the stack. Used to bounds-check drops. */
  itemCount: number;
  /** Called once on successful drop (target !== source). The hook does NOT
   *  call this for drop-on-same-position. */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Optional callback fired the moment a drag activates (after long-press
   *  timeout, before any movement). Callers use this to close any open
   *  numpad / dismiss focus. */
  onDragStart?: () => void;
  /** Long-press duration in ms before drag activates. Default 350. */
  longPressMs?: number;
  /** Movement (px) before long-press is cancelled (treated as scroll/tap).
   *  Default 8. */
  cancelMoveThreshold?: number;
  /** Distance from stack edge (px) at which autoscroll engages. Default 80. */
  autoscrollEdge?: number;
}

interface CardProps {
  /** Set this ref on the card root so the hook can measure rects at drag start. */
  ref: (el: HTMLDivElement | null) => void;
  /** Spread these on the press-target element (e.g. `.eb2-head`). */
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
  /** True for the card currently lifted. */
  isDragging: boolean;
  /** Px to translateY this card by (sibling displacement, or live drag offset
   *  for the dragged card). 0 when idle. */
  displacement: number;
}

interface UseReorderableStackResult {
  /** Attach to the scrollable stack element (e.g. `.ses-stack`). */
  stackRef: React.RefObject<HTMLDivElement>;
  /** True while a drag is active (use it to add `.is-reordering` to the stack). */
  isReordering: boolean;
  /** Returns drag-related props for the card at the given index. */
  getCardProps: (index: number) => CardProps;
}

export function useReorderableStack(
  opts: UseReorderableStackOpts,
): UseReorderableStackResult {
  const {
    itemCount,
    onReorder,
    onDragStart,
    longPressMs = 350,
    cancelMoveThreshold = 8,
    autoscrollEdge = 80,
  } = opts;

  const stackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Mutable drag state lives in a ref so pointermove handlers don't restart
  // event listeners. React state mirrors only what the UI needs to render.
  const drag = useRef<{
    phase: 'idle' | 'armed' | 'dragging';
    sourceIndex: number;
    startY: number;
    pressTimer: number | null;
    rects: { top: number; height: number; mid: number }[];
    cardHeight: number;
    pointerId: number | null;
    autoscrollRaf: number | null;
    lastPointerY: number;
  }>({
    phase: 'idle',
    sourceIndex: -1,
    startY: 0,
    pressTimer: null,
    rects: [],
    cardHeight: 0,
    pointerId: null,
    autoscrollRaf: null,
    lastPointerY: 0,
  });

  // Renderable state: which card is dragging, current offset, and the
  // displacement map (index -> px translateY).
  const [draggingIndex, setDraggingIndex] = useState(-1);
  const [dragOffset, setDragOffset] = useState(0);
  const [displacements, setDisplacements] = useState<Record<number, number>>({});

  const clearPress = useCallback(() => {
    if (drag.current.pressTimer !== null) {
      window.clearTimeout(drag.current.pressTimer);
      drag.current.pressTimer = null;
    }
  }, []);

  const stopAutoscroll = useCallback(() => {
    if (drag.current.autoscrollRaf !== null) {
      cancelAnimationFrame(drag.current.autoscrollRaf);
      drag.current.autoscrollRaf = null;
    }
  }, []);

  const computeTargetIndex = useCallback((pointerY: number): number => {
    // Where the centre of the dragged card currently sits, projected onto the
    // original layout (we use the cached rects, not live DOM, so the moving
    // siblings don't confuse the math).
    const { rects, sourceIndex, startY } = drag.current;
    if (rects.length === 0) return sourceIndex;
    const sourceMid = rects[sourceIndex].mid;
    const draggedMid = sourceMid + (pointerY - startY);
    // First slot whose midpoint is past the dragged card's centre.
    for (let i = 0; i < rects.length; i++) {
      if (draggedMid < rects[i].mid) return i;
    }
    return rects.length - 1;
  }, []);

  const updateDisplacements = useCallback(
    (sourceIndex: number, targetIndex: number, cardHeight: number) => {
      const next: Record<number, number> = {};
      if (targetIndex === sourceIndex) {
        setDisplacements(next);
        return;
      }
      if (targetIndex > sourceIndex) {
        // Dragging downward: every card between source+1 and target shifts up.
        for (let i = sourceIndex + 1; i <= targetIndex; i++) {
          next[i] = -cardHeight;
        }
      } else {
        // Dragging upward: every card between target and source-1 shifts down.
        for (let i = targetIndex; i < sourceIndex; i++) {
          next[i] = cardHeight;
        }
      }
      setDisplacements(next);
    },
    [],
  );

  const runAutoscroll = useCallback(() => {
    const stack = stackRef.current;
    if (!stack || drag.current.phase !== 'dragging') {
      drag.current.autoscrollRaf = null;
      return;
    }
    const rect = stack.getBoundingClientRect();
    const y = drag.current.lastPointerY;
    let dy = 0;
    if (y < rect.top + autoscrollEdge) {
      const proximity = (rect.top + autoscrollEdge - y) / autoscrollEdge;
      dy = -8 * Math.min(1, Math.max(0, proximity));
    } else if (y > rect.bottom - autoscrollEdge) {
      const proximity = (y - (rect.bottom - autoscrollEdge)) / autoscrollEdge;
      dy = 8 * Math.min(1, Math.max(0, proximity));
    }
    if (dy !== 0) {
      stack.scrollBy({ top: dy, behavior: 'auto' });
      // Update the source rect baseline so the drag math stays consistent
      // with the scrolled viewport: shift startY by the same delta.
      drag.current.startY -= dy;
    }
    drag.current.autoscrollRaf = requestAnimationFrame(runAutoscroll);
  }, [autoscrollEdge]);

  const activateDrag = useCallback(
    (index: number, pointerId: number) => {
      const cards = cardRefs.current;
      if (cards.length === 0) return;
      const rects = cards.map((el) => {
        if (!el) return { top: 0, height: 0, mid: 0 };
        const r = el.getBoundingClientRect();
        return { top: r.top, height: r.height, mid: r.top + r.height / 2 };
      });
      const cardHeight =
        rects[index]?.height ||
        rects.find((r) => r.height > 0)?.height ||
        0;

      drag.current.phase = 'dragging';
      drag.current.rects = rects;
      drag.current.cardHeight = cardHeight;
      drag.current.pointerId = pointerId;

      setDraggingIndex(index);
      setDragOffset(0);
      setDisplacements({});

      if ('vibrate' in navigator) {
        try { navigator.vibrate(8); } catch { /* noop */ }
      }
      onDragStart?.();
      drag.current.autoscrollRaf = requestAnimationFrame(runAutoscroll);
    },
    [onDragStart, runAutoscroll],
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      const { sourceIndex, lastPointerY } = drag.current;
      stopAutoscroll();
      let targetIndex = sourceIndex;
      if (commit && drag.current.phase === 'dragging') {
        targetIndex = computeTargetIndex(lastPointerY);
      }
      drag.current.phase = 'idle';
      drag.current.pointerId = null;
      drag.current.rects = [];
      drag.current.cardHeight = 0;
      setDraggingIndex(-1);
      setDragOffset(0);
      setDisplacements({});
      if (commit && targetIndex !== sourceIndex) {
        if ('vibrate' in navigator) {
          try { navigator.vibrate(12); } catch { /* noop */ }
        }
        onReorder(sourceIndex, targetIndex);
      }
    },
    [computeTargetIndex, onReorder, stopAutoscroll],
  );

  // Clean up timers / RAFs on unmount.
  useEffect(() => {
    return () => {
      clearPress();
      stopAutoscroll();
    };
  }, [clearPress, stopAutoscroll]);

  const getCardProps = useCallback(
    (index: number): CardProps => {
      const isDragging = draggingIndex === index;
      const displacement = isDragging ? dragOffset : displacements[index] ?? 0;
      return {
        ref: (el) => {
          cardRefs.current[index] = el;
        },
        dragHandleProps: {
          onPointerDown: (e) => {
            // Only primary button / primary touch.
            if (e.button !== undefined && e.button !== 0) return;
            if (drag.current.phase !== 'idle') return;
            drag.current.phase = 'armed';
            drag.current.sourceIndex = index;
            drag.current.startY = e.clientY;
            drag.current.lastPointerY = e.clientY;
            drag.current.pressTimer = window.setTimeout(() => {
              drag.current.pressTimer = null;
              if (drag.current.phase !== 'armed') return;
              // Capture the pointer onto the card root so subsequent moves
              // route here even if the finger drifts off the header.
              const card = cardRefs.current[index];
              try { card?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
              activateDrag(index, e.pointerId);
            }, longPressMs);
          },
          onPointerMove: (e) => {
            drag.current.lastPointerY = e.clientY;
            if (drag.current.phase === 'armed') {
              const dy = Math.abs(e.clientY - drag.current.startY);
              if (dy > cancelMoveThreshold) {
                clearPress();
                drag.current.phase = 'idle';
              }
              return;
            }
            if (drag.current.phase !== 'dragging') return;
            if (drag.current.sourceIndex !== index) return;
            const offset = e.clientY - drag.current.startY;
            setDragOffset(offset);
            const target = computeTargetIndex(e.clientY);
            updateDisplacements(
              drag.current.sourceIndex,
              target,
              drag.current.cardHeight,
            );
          },
          onPointerUp: (e) => {
            if (drag.current.phase === 'armed') {
              clearPress();
              drag.current.phase = 'idle';
              return;
            }
            if (drag.current.phase !== 'dragging') return;
            try {
              cardRefs.current[index]?.releasePointerCapture?.(e.pointerId);
            } catch { /* noop */ }
            endDrag(true);
          },
          onPointerCancel: (e) => {
            if (drag.current.phase === 'armed') {
              clearPress();
              drag.current.phase = 'idle';
              return;
            }
            if (drag.current.phase !== 'dragging') return;
            try {
              cardRefs.current[index]?.releasePointerCapture?.(e.pointerId);
            } catch { /* noop */ }
            endDrag(false);
          },
        },
        isDragging,
        displacement,
      };
    },
    [
      draggingIndex,
      dragOffset,
      displacements,
      activateDrag,
      clearPress,
      computeTargetIndex,
      endDrag,
      cancelMoveThreshold,
      longPressMs,
      updateDisplacements,
    ],
  );

  // Trim card ref array if itemCount shrinks.
  useEffect(() => {
    cardRefs.current.length = itemCount;
  }, [itemCount]);

  return {
    stackRef,
    isReordering: draggingIndex !== -1,
    getCardProps,
  };
}
