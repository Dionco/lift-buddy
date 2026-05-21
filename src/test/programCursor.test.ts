import { describe, it, expect } from 'vitest';
import {
  findDayById,
  getCurrentLocation,
  computeNextCursor,
  computeBlockBoundaryChoice,
  isCursor,
  isPast,
} from '@/lib/programCursor';
import { Program, ProgramDay, ProgramWeek, ProgramBlock } from '@/types/training';

function day(id: string): ProgramDay {
  return { id, name: id, exercises: [] };
}

function week(id: string, weekNumber: number, dayCount: number): ProgramWeek {
  return {
    id,
    weekNumber,
    days: Array.from({ length: dayCount }, (_, i) => day(`${id}-d${i + 1}`)),
  };
}

function block(id: string, name: string, weekCount: number, dayCount: number): ProgramBlock {
  return {
    id,
    name,
    focus: 'Volume',
    weeks: Array.from({ length: weekCount }, (_, i) => week(`${id}-w${i + 1}`, i + 1, dayCount)),
  };
}

function program(opts: {
  blockCount: number;
  weekCount: number;
  dayCount: number;
  cursor: [number, number, number];
}): Program {
  const blocks = Array.from({ length: opts.blockCount }, (_, i) =>
    block(`b${i + 1}`, `Block ${i + 1}`, opts.weekCount, opts.dayCount),
  );
  return {
    id: 'p',
    name: 'P',
    blocks,
    currentBlockIndex: opts.cursor[0],
    currentWeekIndex: opts.cursor[1],
    currentDayIndex: opts.cursor[2],
  };
}

describe('findDayById', () => {
  it('returns the location of a Day deep in the hierarchy', () => {
    const p = program({ blockCount: 2, weekCount: 3, dayCount: 4, cursor: [0, 0, 0] });
    const target = p.blocks[1].weeks[2].days[3];
    const loc = findDayById(p, target.id);
    expect(loc).not.toBeNull();
    expect(loc!.blockIndex).toBe(1);
    expect(loc!.weekIndex).toBe(2);
    expect(loc!.dayIndex).toBe(3);
    expect(loc!.day).toBe(target);
  });

  it('returns null for unknown ids', () => {
    const p = program({ blockCount: 1, weekCount: 1, dayCount: 1, cursor: [0, 0, 0] });
    expect(findDayById(p, 'nope')).toBeNull();
  });
});

describe('getCurrentLocation', () => {
  it('resolves the cursor', () => {
    const p = program({ blockCount: 2, weekCount: 2, dayCount: 3, cursor: [1, 1, 2] });
    const loc = getCurrentLocation(p);
    expect(loc!.blockIndex).toBe(1);
    expect(loc!.weekIndex).toBe(1);
    expect(loc!.dayIndex).toBe(2);
  });

  it('returns null when cursor is out of bounds', () => {
    const p = program({ blockCount: 1, weekCount: 1, dayCount: 1, cursor: [5, 0, 0] });
    expect(getCurrentLocation(p)).toBeNull();
  });
});

describe('computeNextCursor', () => {
  it('advances Day-by-Day within a Week', () => {
    const p = program({ blockCount: 1, weekCount: 1, dayCount: 3, cursor: [0, 0, 1] });
    const r = computeNextCursor(p);
    expect(r.next).toEqual({ blockIndex: 0, weekIndex: 0, dayIndex: 2 });
    expect(r.blockBoundaryCrossed).toBe(false);
    expect(r.programComplete).toBe(false);
  });

  it('advances Week and resets Day at week boundary', () => {
    const p = program({ blockCount: 1, weekCount: 2, dayCount: 3, cursor: [0, 0, 2] });
    const r = computeNextCursor(p);
    expect(r.next).toEqual({ blockIndex: 0, weekIndex: 1, dayIndex: 0 });
    expect(r.blockBoundaryCrossed).toBe(false);
  });

  it('refuses to auto-advance at a Block boundary; surfaces the flag instead', () => {
    const p = program({ blockCount: 2, weekCount: 1, dayCount: 1, cursor: [0, 0, 0] });
    const r = computeNextCursor(p);
    expect(r.next).toBeNull();
    expect(r.blockBoundaryCrossed).toBe(true);
    expect(r.programComplete).toBe(false);
  });

  it('marks programComplete on the final Day of the final Block', () => {
    const p = program({ blockCount: 1, weekCount: 1, dayCount: 1, cursor: [0, 0, 0] });
    const r = computeNextCursor(p);
    expect(r.next).toBeNull();
    expect(r.blockBoundaryCrossed).toBe(true);
    expect(r.programComplete).toBe(true);
  });
});

describe('computeBlockBoundaryChoice', () => {
  it('advance moves to first Day of first Week of next Block', () => {
    const p = program({ blockCount: 3, weekCount: 2, dayCount: 2, cursor: [1, 1, 1] });
    const next = computeBlockBoundaryChoice(p, { blockIndex: 1, weekIndex: 1, dayIndex: 1 }, 'advance');
    expect(next).toEqual({ blockIndex: 2, weekIndex: 0, dayIndex: 0 });
  });

  it('advance returns null when there is no next Block', () => {
    const p = program({ blockCount: 2, weekCount: 1, dayCount: 1, cursor: [1, 0, 0] });
    const next = computeBlockBoundaryChoice(p, { blockIndex: 1, weekIndex: 0, dayIndex: 0 }, 'advance');
    expect(next).toBeNull();
  });

  it('repeat restarts at the beginning of the same Block', () => {
    const p = program({ blockCount: 2, weekCount: 3, dayCount: 3, cursor: [0, 2, 2] });
    const next = computeBlockBoundaryChoice(p, { blockIndex: 0, weekIndex: 2, dayIndex: 2 }, 'repeat');
    expect(next).toEqual({ blockIndex: 0, weekIndex: 0, dayIndex: 0 });
  });

  it('deload stays on the current Block/Week, restarts the Day', () => {
    const p = program({ blockCount: 2, weekCount: 3, dayCount: 3, cursor: [0, 2, 2] });
    const next = computeBlockBoundaryChoice(p, { blockIndex: 0, weekIndex: 2, dayIndex: 2 }, 'deload');
    expect(next).toEqual({ blockIndex: 0, weekIndex: 2, dayIndex: 0 });
  });
});

describe('isCursor / isPast', () => {
  const p = program({ blockCount: 2, weekCount: 2, dayCount: 2, cursor: [1, 0, 1] });

  it('isCursor matches exactly', () => {
    expect(isCursor(p, 1, 0, 1)).toBe(true);
    expect(isCursor(p, 1, 0, 0)).toBe(false);
    expect(isCursor(p, 0, 0, 1)).toBe(false);
  });

  it('isPast handles all three coordinate axes', () => {
    expect(isPast(p, 0, 0, 0)).toBe(true); // earlier block
    expect(isPast(p, 0, 1, 1)).toBe(true); // earlier block (any week/day)
    expect(isPast(p, 1, 0, 0)).toBe(true); // same block/week, earlier day
    expect(isPast(p, 1, 0, 1)).toBe(false); // exactly at cursor — not past
    expect(isPast(p, 1, 1, 0)).toBe(false); // later week
    expect(isPast(p, 2, 0, 0)).toBe(false); // later block (out of range, but not past)
  });
});
