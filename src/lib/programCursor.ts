import { Program, ProgramDay, ProgramWeek, ProgramBlock } from '@/types/training';

export interface CursorIndices {
  blockIndex: number;
  weekIndex: number;
  dayIndex: number;
}

export interface DayLocation extends CursorIndices {
  block: ProgramBlock;
  week: ProgramWeek;
  day: ProgramDay;
}

/**
 * Locate a ProgramDay anywhere in the Program by its id. Returns null when no
 * Day in the Program has that id (e.g. a Session pinned to a Day that was later
 * removed from the Program).
 */
export function findDayById(program: Program, dayId: string): DayLocation | null {
  for (let bi = 0; bi < program.blocks.length; bi++) {
    const block = program.blocks[bi];
    for (let wi = 0; wi < block.weeks.length; wi++) {
      const week = block.weeks[wi];
      for (let di = 0; di < week.days.length; di++) {
        const day = week.days[di];
        if (day.id === dayId) {
          return { block, week, day, blockIndex: bi, weekIndex: wi, dayIndex: di };
        }
      }
    }
  }
  return null;
}

/**
 * Resolve the Block/Week/Day the cursor currently points to. Returns null when
 * the cursor indices fall outside the Program (corrupted persistence, etc.).
 */
export function getCurrentLocation(program: Program): DayLocation | null {
  const block = program.blocks[program.currentBlockIndex];
  const week = block?.weeks[program.currentWeekIndex];
  const day = week?.days[program.currentDayIndex];
  if (!block || !week || !day) return null;
  return {
    block,
    week,
    day,
    blockIndex: program.currentBlockIndex,
    weekIndex: program.currentWeekIndex,
    dayIndex: program.currentDayIndex,
  };
}

export interface NextCursorResult {
  /** The cursor indices to apply, or null if the program is complete or invalid. */
  next: CursorIndices | null;
  /**
   * The lifter just finished the last Day of the last Week of the current Block.
   * The UI should prompt for advance/repeat/deload before applying `next` for the
   * Block jump (per ADR-0004); within-block advances do not set this flag.
   */
  blockBoundaryCrossed: boolean;
  /** Cursor was already on the final Day of the final Block — no further advance. */
  programComplete: boolean;
}

/**
 * Compute (without mutating) where the cursor should move to after completing
 * the Day it currently points to. Per ADR-0004, this advances Day → Week within
 * a Block automatically, but stops at the Block boundary so the lifter can pick
 * advance / repeat / deload.
 */
export function computeNextCursor(program: Program): NextCursorResult {
  const location = getCurrentLocation(program);
  if (!location) {
    return { next: null, blockBoundaryCrossed: false, programComplete: true };
  }
  const { blockIndex, weekIndex, dayIndex, block, week } = location;

  const isLastDay = dayIndex >= week.days.length - 1;
  const isLastWeek = weekIndex >= block.weeks.length - 1;
  const isLastBlock = blockIndex >= program.blocks.length - 1;

  if (!isLastDay) {
    return {
      next: { blockIndex, weekIndex, dayIndex: dayIndex + 1 },
      blockBoundaryCrossed: false,
      programComplete: false,
    };
  }
  if (!isLastWeek) {
    return {
      next: { blockIndex, weekIndex: weekIndex + 1, dayIndex: 0 },
      blockBoundaryCrossed: false,
      programComplete: false,
    };
  }
  if (!isLastBlock) {
    // Don't auto-advance the block — surface the boundary so the UI can prompt.
    return { next: null, blockBoundaryCrossed: true, programComplete: false };
  }
  return { next: null, blockBoundaryCrossed: true, programComplete: true };
}

export type BlockBoundaryChoice = 'advance' | 'repeat' | 'deload';

/**
 * Resolve the cursor indices for each end-of-block choice (per ADR-0004 prompt).
 *
 *   - 'advance': move to first Day of first Week of the next Block. Returns null
 *     when there is no next Block (program complete).
 *   - 'repeat':  restart at first Day of first Week of the same Block.
 *   - 'deload':  restart at first Day of the *current* Week of the same Block.
 *     Per ADR-0002 spirit we don't model deload as data — the lifter manages
 *     load adjustment manually.
 */
export function computeBlockBoundaryChoice(
  program: Program,
  location: CursorIndices,
  choice: BlockBoundaryChoice,
): CursorIndices | null {
  const { blockIndex, weekIndex } = location;
  switch (choice) {
    case 'advance': {
      const next = blockIndex + 1;
      if (next >= program.blocks.length) return null;
      return { blockIndex: next, weekIndex: 0, dayIndex: 0 };
    }
    case 'repeat':
      return { blockIndex, weekIndex: 0, dayIndex: 0 };
    case 'deload':
      return { blockIndex, weekIndex, dayIndex: 0 };
  }
}

/** True iff the given coordinates match the Program's cursor exactly. */
export function isCursor(program: Program, bi: number, wi: number, di: number): boolean {
  return (
    bi === program.currentBlockIndex &&
    wi === program.currentWeekIndex &&
    di === program.currentDayIndex
  );
}

/** True iff the given coordinates point to a Day strictly before the cursor. */
export function isPast(program: Program, bi: number, wi: number, di: number): boolean {
  if (bi < program.currentBlockIndex) return true;
  if (bi > program.currentBlockIndex) return false;
  if (wi < program.currentWeekIndex) return true;
  if (wi > program.currentWeekIndex) return false;
  return di < program.currentDayIndex;
}
