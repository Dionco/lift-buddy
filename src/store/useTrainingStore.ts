import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Program, ExerciseLog, SetLog, ReadinessCheckIn, ProgramBlock } from '@/types/training';
import { sampleProgram } from '@/data/sampleProgram';
import { sampleSessions } from '@/data/sampleSessions';

export interface AdvanceCursorResult {
  /** True if the lifter just finished the last Day of the last Week of the current Block. */
  blockBoundaryCrossed: boolean;
  /** The cursor was already on the final Day of the final Block — there's nowhere further to advance. */
  programComplete: boolean;
}

interface TrainingState {
  sessions: Session[];
  program: Program;
  activeSession: Session | null;
  restTimerDuration: number; // seconds

  startSession: (workoutName?: string, programDayId?: string, exercises?: ExerciseLog[]) => void;
  setReadiness: (readiness: ReadinessCheckIn) => void;
  addExercise: (exerciseLog: ExerciseLog) => void;
  logSet: (exerciseIndex: number, set: SetLog) => void;
  updateSet: (exerciseIndex: number, setIndex: number, set: Partial<SetLog>) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  addSetToExercise: (exerciseIndex: number) => void;
  finishSession: (note?: string) => void;
  cancelSession: () => void;
  setRestTimerDuration: (seconds: number) => void;
  /**
   * Advance the program cursor by one Day. Walks Day → Week → Block.
   * Returns whether a Block boundary was crossed (so the UI can prompt) and
   * whether the program is now complete (cursor was on the final Day already).
   * Never advances past the end; the caller decides what to do via `setProgramCursor`.
   */
  advanceProgramCursor: () => AdvanceCursorResult;
  /** Explicit cursor jump (used by end-of-block "repeat block" / "jump to" choices). */
  setProgramCursor: (blockIndex: number, weekIndex: number, dayIndex: number) => void;
}

/**
 * Migrate persisted state across schema versions.
 *
 * Versions:
 *  - 0 (or undefined): pre-Week-layer. ProgramBlock had `weekNumber: number` and `days: ProgramDay[]`.
 *    Program lacked `currentWeekIndex`. We wrap each old block's `days` into a single Week.
 *  - 1: post-Week-layer. ProgramBlock has `weeks: ProgramWeek[]`; Program has `currentWeekIndex`.
 */
function migrate(persistedState: unknown, version: number): TrainingState {
  const state = persistedState as Partial<TrainingState> & { program?: unknown };
  if (version < 1 && state.program && typeof state.program === 'object') {
    const oldProgram = state.program as {
      id?: string;
      name?: string;
      blocks?: Array<{ id: string; name: string; weekNumber?: number; focus: string; days: unknown[] }>;
      currentBlockIndex?: number;
      currentDayIndex?: number;
    };
    const migratedBlocks: ProgramBlock[] = (oldProgram.blocks ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      focus: b.focus,
      weeks: [
        {
          id: `${b.id}w1`,
          weekNumber: b.weekNumber ?? 1,
          days: (b.days ?? []) as ProgramBlock['weeks'][number]['days'],
        },
      ],
    }));
    state.program = {
      id: oldProgram.id ?? 'prog1',
      name: oldProgram.name ?? 'Program',
      blocks: migratedBlocks,
      currentBlockIndex: oldProgram.currentBlockIndex ?? 0,
      currentWeekIndex: 0,
      currentDayIndex: oldProgram.currentDayIndex ?? 0,
    } as Program;
  }
  return state as TrainingState;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      sessions: sampleSessions,
      program: sampleProgram,
      activeSession: null,
      restTimerDuration: 120,

      startSession: (workoutName, programDayId, exercises) => {
        const session: Session = {
          id: `session-${Date.now()}`,
          startTime: Date.now(),
          exercises: exercises || [],
          workoutName,
          programDayId,
        };
        set({ activeSession: session });
      },

      setReadiness: (readiness) => {
        const { activeSession } = get();
        if (activeSession) {
          set({ activeSession: { ...activeSession, readiness } });
        }
      },

      addExercise: (exerciseLog) => {
        const { activeSession } = get();
        if (activeSession) {
          set({
            activeSession: {
              ...activeSession,
              exercises: [...activeSession.exercises, exerciseLog],
            },
          });
        }
      },

      logSet: (exerciseIndex, setData) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = [...activeSession.exercises];
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          sets: [...exercises[exerciseIndex].sets, setData],
        };
        set({ activeSession: { ...activeSession, exercises } });
      },

      updateSet: (exerciseIndex, setIndex, updates) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = [...activeSession.exercises];
        const sets = [...exercises[exerciseIndex].sets];
        sets[setIndex] = { ...sets[setIndex], ...updates };
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };
        set({ activeSession: { ...activeSession, exercises } });
      },

      removeSet: (exerciseIndex, setIndex) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = [...activeSession.exercises];
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          sets: exercises[exerciseIndex].sets.filter((_, i) => i !== setIndex),
        };
        set({ activeSession: { ...activeSession, exercises } });
      },

      addSetToExercise: (exerciseIndex) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = [...activeSession.exercises];
        const lastSet = exercises[exerciseIndex].sets[exercises[exerciseIndex].sets.length - 1];
        const newSet: SetLog = {
          id: `set-${Date.now()}`,
          weight: lastSet?.weight || 0,
          reps: lastSet?.reps || 0,
          rpe: lastSet?.rpe || 7,
          timestamp: Date.now(),
          completed: false,
        };
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          sets: [...exercises[exerciseIndex].sets, newSet],
        };
        set({ activeSession: { ...activeSession, exercises } });
      },

      finishSession: (note) => {
        const { activeSession, sessions } = get();
        if (!activeSession) return;
        const finished: Session = {
          ...activeSession,
          endTime: Date.now(),
          note,
        };
        set({
          sessions: [finished, ...sessions],
          activeSession: null,
        });
      },

      cancelSession: () => set({ activeSession: null }),

      setRestTimerDuration: (seconds) => set({ restTimerDuration: seconds }),

      advanceProgramCursor: () => {
        const { program } = get();
        const block = program.blocks[program.currentBlockIndex];
        const week = block?.weeks[program.currentWeekIndex];
        if (!block || !week) {
          return { blockBoundaryCrossed: false, programComplete: true };
        }

        const isLastDay = program.currentDayIndex >= week.days.length - 1;
        const isLastWeek = program.currentWeekIndex >= block.weeks.length - 1;
        const isLastBlock = program.currentBlockIndex >= program.blocks.length - 1;

        if (!isLastDay) {
          set({ program: { ...program, currentDayIndex: program.currentDayIndex + 1 } });
          return { blockBoundaryCrossed: false, programComplete: false };
        }

        if (!isLastWeek) {
          set({
            program: {
              ...program,
              currentWeekIndex: program.currentWeekIndex + 1,
              currentDayIndex: 0,
            },
          });
          return { blockBoundaryCrossed: false, programComplete: false };
        }

        if (!isLastBlock) {
          // Surface the boundary; do not auto-advance the block (lifter chooses via end-of-block sheet).
          return { blockBoundaryCrossed: true, programComplete: false };
        }

        return { blockBoundaryCrossed: true, programComplete: true };
      },

      setProgramCursor: (blockIndex, weekIndex, dayIndex) => {
        const { program } = get();
        set({
          program: {
            ...program,
            currentBlockIndex: blockIndex,
            currentWeekIndex: weekIndex,
            currentDayIndex: dayIndex,
          },
        });
      },
    }),
    {
      name: 'training-store',
      version: 1,
      migrate: (persistedState, version) => migrate(persistedState, version),
    }
  )
);
