/**
 * Decide how to scroll the active workout's exercise stack so the focused
 * set row stays in the visible window above the numpad.
 *
 * Pure function so the math is testable without browser layout. The caller
 * passes rect coordinates already read from `getBoundingClientRect()` plus
 * the numpad's actual offset height (or 0 when the numpad is closed).
 *
 * On cramped viewports (e.g. iPhone SE-class screens where the numpad eats
 * more of the stack than the headroom allows) `visibleBottom` can land
 * above `visibleTop`. Without a clamp, the "row.bottom > visibleBottom"
 * branch over-scrolls and lifts the row off the top edge of the stack —
 * the row disappears entirely behind the overflow clip. We detect that
 * collapsed window and align the row to `visibleTop` instead, accepting
 * that the numpad may cover part of the row but keeping it on screen.
 */
export interface ScrollInputs {
  stackTop: number;
  stackBottom: number;
  rowTop: number;
  rowBottom: number;
  numpadHeight: number;
  headroom?: number;
  buffer?: number;
}

const DEFAULT_HEADROOM = 56;
const DEFAULT_BUFFER = 20;

export function computeNumpadScrollDelta(opts: ScrollInputs): number {
  const headroom = opts.headroom ?? DEFAULT_HEADROOM;
  const buffer = opts.buffer ?? DEFAULT_BUFFER;
  const visibleTop = opts.stackTop + headroom;
  const visibleBottom = opts.stackBottom - opts.numpadHeight - buffer;

  // Degenerate window — numpad + headroom + buffer exceeds stack height.
  // Best we can do is pin row.top to visibleTop and let the numpad cover
  // whatever overflows; anything else risks scrolling the row off-screen.
  if (visibleBottom <= visibleTop) {
    return opts.rowTop - visibleTop;
  }

  if (opts.rowTop < visibleTop) {
    return opts.rowTop - visibleTop;
  }
  if (opts.rowBottom > visibleBottom) {
    // Clamp so that pushing the row up to fit above the numpad never lifts
    // its top above `visibleTop`. On short viewports the unclamped delta
    // can exceed `rowTop - visibleTop`, which would clip the row.
    const desired = opts.rowBottom - visibleBottom;
    const maxUpward = opts.rowTop - visibleTop;
    return Math.min(desired, maxUpward);
  }
  return 0;
}
