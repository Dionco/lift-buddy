import { describe, it, expect } from 'vitest';
import { computeNumpadScrollDelta } from '@/lib/numpadScroll';

/**
 * Synthetic viewport rectangles. Coordinates are in viewport space (pixels).
 * "Roomy" mimics an iPhone 14 (844pt) where stack height comfortably exceeds
 * the numpad. "Cramped" mimics an iPhone SE (568pt) where the numpad + the
 * top headroom together exceed the stack — the bug condition reported in
 * the original issue.
 */
const roomyStack = { stackTop: 130, stackBottom: 844 };
const crampedStack = { stackTop: 130, stackBottom: 568 };
const numpad = 416; // approximate numpad offsetHeight on phones

describe('computeNumpadScrollDelta', () => {
  it('returns 0 when the row already fits inside the visible window', () => {
    const delta = computeNumpadScrollDelta({
      ...roomyStack,
      rowTop: 240,
      rowBottom: 280,
      numpadHeight: numpad,
    });
    expect(delta).toBe(0);
  });

  it('scrolls down (positive) when the row sits below the numpad top', () => {
    const delta = computeNumpadScrollDelta({
      ...roomyStack,
      rowTop: 420,
      rowBottom: 460,
      numpadHeight: numpad,
    });
    // visibleBottom = 844 - 416 - 20 = 408. Row bottom 460 → delta 52.
    expect(delta).toBe(52);
  });

  it('scrolls up (negative) when the row sits above the headroom', () => {
    const delta = computeNumpadScrollDelta({
      ...roomyStack,
      rowTop: 150,
      rowBottom: 190,
      numpadHeight: numpad,
    });
    // visibleTop = 130 + 56 = 186. Row top 150 → delta -36.
    expect(delta).toBe(-36);
  });

  it('does not scroll the row above visibleTop on a cramped viewport', () => {
    // Cramped: stackTop 130, stackBottom 568, numpad 416 → visibleBottom = 132,
    // visibleTop = 186. The window collapses (visibleBottom < visibleTop). The
    // OLD algorithm would scroll by rowBottom - visibleBottom = 280 - 132 = 148,
    // landing the row at viewport y=92..132 — entirely clipped above the stack
    // (which starts at y=130). Regression: cap the delta so the row never lifts
    // above the stack's headroom.
    const delta = computeNumpadScrollDelta({
      ...crampedStack,
      rowTop: 240,
      rowBottom: 280,
      numpadHeight: numpad,
    });
    // Row top 240, visibleTop 186 → max upward delta is 54. The row stays
    // at viewport y=186..226 — partially under the numpad (top at y=152)
    // but at least visible.
    expect(delta).toBe(54);
  });

  it('on a cramped viewport, snaps a row at the very top to visibleTop', () => {
    const delta = computeNumpadScrollDelta({
      ...crampedStack,
      rowTop: 150,
      rowBottom: 190,
      numpadHeight: numpad,
    });
    // rowTop 150 < visibleTop 186 → delta -36 (scroll down so row.top reaches visibleTop).
    expect(delta).toBe(-36);
  });

  it('treats numpadHeight=0 (closed numpad) as having no overlay', () => {
    const delta = computeNumpadScrollDelta({
      ...roomyStack,
      rowTop: 240,
      rowBottom: 280,
      numpadHeight: 0,
    });
    expect(delta).toBe(0);
  });
});
