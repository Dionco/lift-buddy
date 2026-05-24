import { describe, it, expect } from 'vitest';
import { isSameCalendarDay } from '@/lib/sameCalendarDay';

describe('isSameCalendarDay', () => {
  it('returns true for two timestamps on the same calendar day', () => {
    const morning = new Date(2026, 4, 24, 8, 30).getTime();
    const evening = new Date(2026, 4, 24, 22, 15).getTime();
    expect(isSameCalendarDay(morning, evening)).toBe(true);
  });

  it('returns false across the midnight boundary, even if only minutes apart', () => {
    const justBefore = new Date(2026, 4, 24, 23, 59).getTime();
    const justAfter = new Date(2026, 4, 25, 0, 1).getTime();
    expect(isSameCalendarDay(justBefore, justAfter)).toBe(false);
  });

  it('returns false across a month boundary', () => {
    const apr30 = new Date(2026, 3, 30, 12, 0).getTime();
    const may1 = new Date(2026, 4, 1, 12, 0).getTime();
    expect(isSameCalendarDay(apr30, may1)).toBe(false);
  });

  it('returns false across a year boundary', () => {
    const dec31 = new Date(2025, 11, 31, 23, 0).getTime();
    const jan1 = new Date(2026, 0, 1, 1, 0).getTime();
    expect(isSameCalendarDay(dec31, jan1)).toBe(false);
  });

  it('treats identical timestamps as the same day', () => {
    const t = new Date(2026, 4, 24, 12, 0).getTime();
    expect(isSameCalendarDay(t, t)).toBe(true);
  });
});
