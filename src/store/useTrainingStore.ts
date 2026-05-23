import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Program, ExerciseLog, SetLog, ReadinessCheckIn, ProgramBlock, Exercise, MuscleGroup } from '@/types/training';
import { computeNextCursor, NextCursorResult } from '@/lib/programCursor';
import { sampleProgram, EXERCISES } from '@/data/sampleProgram';
import { sampleSessions } from '@/data/sampleSessions';

export type AdvanceCursorResult = Pick<NextCursorResult, 'blockBoundaryCrossed' | 'programComplete'>;

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
  removeExercise: (exerciseIndex: number) => void;
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
 * Fallback mapping from the legacy single `muscleGroup` value to the new
 * `primaryMuscles` array — used during v1→v2 migration when an Exercise id
 * isn't found in the current `EXERCISES` table (e.g. removed/renamed seed
 * exercises). The known-id path uses the canonical primary/secondary tagging.
 */
const LEGACY_MUSCLE_GROUP_MAP: Record<string, MuscleGroup[]> = {
  Quads: ['Quads'],
  Glutes: ['Glutes'],
  Chest: ['Chest'],
  Triceps: ['Triceps'],
  Back: ['Lats', 'Upper Back'],
  Hamstrings: ['Hamstrings'],
  Shoulders: ['Front Delts', 'Side Delts'],
  Biceps: ['Biceps'],
  Core: ['Core'],
  'Posterior Chain': ['Glutes', 'Hamstrings', 'Spinal Erectors'],
};

type LegacyExercise = {
  id?: string;
  name?: string;
  muscleGroup?: string;
  primaryMuscles?: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  isMainLift?: boolean;
  relatedTo?: string;
};

function migrateExercise(legacy: LegacyExercise): Exercise {
  // Already migrated — round-trip safe.
  if (Array.isArray(legacy.primaryMuscles) && legacy.primaryMuscles.length > 0) {
    const { muscleGroup: _drop, ...rest } = legacy;
    void _drop;
    return rest as Exercise;
  }
  const id = legacy.id ?? '';
  const canonical = Object.values(EXERCISES).find((e) => e.id === id);
  if (canonical) {
    return {
      ...canonical,
      // Preserve any non-canonical fields the user might have on a custom copy.
      id,
      name: legacy.name ?? canonical.name,
    };
  }
  const fallback = legacy.muscleGroup ? LEGACY_MUSCLE_GROUP_MAP[legacy.muscleGroup] : undefined;
  const { muscleGroup: _drop, ...rest } = legacy;
  void _drop;
  return {
    ...(rest as Omit<LegacyExercise, 'muscleGroup'>),
    id,
    name: legacy.name ?? id,
    isMainLift: !!legacy.isMainLift,
    primaryMuscles: fallback ?? ['Core'],
  } as Exercise;
}

/**
 * Migrate persisted state across schema versions.
 *
 * Versions:
 *  - 0 (or undefined): pre-Week-layer. ProgramBlock had `weekNumber: number` and `days: ProgramDay[]`.
 *    Program lacked `currentWeekIndex`. We wrap each old block's `days` into a single Week.
 *  - 1: post-Week-layer. ProgramBlock has `weeks: ProgramWeek[]`; Program has `currentWeekIndex`.
 *  - 2: Exercise.muscleGroup (single) replaced by primaryMuscles[] + secondaryMuscles[]?.
 *    Walks every Exercise reachable from sessions and program and rewrites the shape.
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
  if (version < 2) {
    if (Array.isArray(state.sessions)) {
      for (const session of state.sessions) {
        for (const log of session.exercises ?? []) {
          log.exercise = migrateExercise(log.exercise as unknown as LegacyExercise);
        }
      }
    }
    if (state.program && typeof state.program === 'object') {
      const program = state.program as Program;
      for (const block of program.blocks ?? []) {
        for (const week of block.weeks ?? []) {
          for (const day of week.days ?? []) {
            for (const pe of day.exercises ?? []) {
              pe.exercise = migrateExercise(pe.exercise as unknown as LegacyExercise);
            }
          }
        }
      }
    }
    if ((state as { activeSession?: Session | null }).activeSession) {
      const active = (state as { activeSession: Session }).activeSession;
      for (const log of active.exercises ?? []) {
        log.exercise = migrateExercise(log.exercise as unknown as LegacyExercise);
      }
    }
  }
  if (version < 3) {
    // v3: refresh seed/demo sessions with the new generated dataset. Real
    // user-logged sessions (id starts with "session-", produced by
    // startSession) are preserved untouched. Old hand-curated sample sessions
    // (s1..s5) and prior generated sets (gen-*) are replaced by the new
    // generator output so the Progress tab has rich demo data.
    const isUserLogged = (id: string) => id.startsWith('session-');
    const userSessions = (state.sessions ?? []).filter((s) => isUserLogged(s.id));
    state.sessions = [...sampleSessions, ...userSessions];
  }
  if (version < 4) {
    // v4: enforce the newest-first Session-order convention. `finishSession`
    // prepends new Sessions, but the v0–v3 seed/migration left `sessions`
    // oldest-first. The order-sensitive lib functions (`fatigueSignal`,
    // `recentTopSetE1RMs`, `lastTopSet`, `mainLiftProgressSignal`) all assume
    // newest-first — an oldest-first array silently fed them the wrong end of
    // history, so fatigue/progress read the lifter's first weeks, not the last.
    if (Array.isArray(state.sessions)) {
      state.sessions = [...state.sessions].sort((a, b) => b.startTime - a.startTime);
    }
  }
  return state as TrainingState;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      // Newest-first — the Session-order convention `finishSession` (prepend)
      // and every order-sensitive lib function rely on. `sampleSessions` is
      // generated oldest-first, so reverse it here.
      sessions: [...sampleSessions].reverse(),
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

      removeExercise: (exerciseIndex) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = activeSession.exercises.filter((_, i) => i !== exerciseIndex);
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
        const result = computeNextCursor(program);
        if (result.next) {
          set({
            program: {
              ...program,
              currentBlockIndex: result.next.blockIndex,
              currentWeekIndex: result.next.weekIndex,
              currentDayIndex: result.next.dayIndex,
            },
          });
        }
        return {
          blockBoundaryCrossed: result.blockBoundaryCrossed,
          programComplete: result.programComplete,
        };
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
      version: 4,
      migrate: (persistedState, version) => migrate(persistedState, version),
    }
  )
);
