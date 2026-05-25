import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Program, ExerciseLog, SetLog, ReadinessCheckIn, ProgramBlock, Exercise, MuscleGroup, TrainingMaxes } from '@/types/training';
import { computeNextCursor, NextCursorResult } from '@/lib/programCursor';
import { EXERCISES } from '@/data/sampleProgram';
import { canditoHybridProgram } from '@/data/canditoHybridProgram';

export type AdvanceCursorResult = Pick<NextCursorResult, 'blockBoundaryCrossed' | 'programComplete'>;

interface TrainingState {
  sessions: Session[];
  program: Program;
  activeSession: Session | null;
  restTimerDuration: number; // seconds
  /** Three-lift Training Maxes that back loadPercentage-based prescriptions.
   *  Null until the lifter has entered them — UI must prompt before any program
   *  day with loadPercentage can compute weights. Cleared on restartProgram so
   *  the next block can be loaded with fresh Training Maxes (e.g. post-test-day
   *  projected maxes). See ADR-0013 for the lifter-owned model. */
  trainingMaxes: TrainingMaxes | null;
  /** Plate-loading increment used to round prescribed weights (typically 2.5kg,
   *  or 1.25kg with fractional plates). */
  loadingIncrement: number;
  /** Most recent Readiness check-in the lifter submitted, with the wall-clock
   *  time it was logged. Used to suppress the Readiness prompt for repeat
   *  session-starts on the same calendar day — including the cancel-and-restart
   *  case where the prior Session never reached `sessions[]`. */
  lastReadiness: { readiness: ReadinessCheckIn; timestamp: number } | null;

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
  setTrainingMaxes: (maxes: TrainingMaxes) => void;
  setLoadingIncrement: (increment: number) => void;
  /** Reset the program cursor to (0,0,0) and clear trainingMaxes so the next
   *  start re-prompts. Used at the end of a 6-week block when restarting with
   *  new projected/tested Training Maxes. */
  restartProgram: () => void;
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
    // No-op: v3 used to refresh demo seed sessions, but seeds are gone (v7
    // strips them). Kept as a numbered slot so the version sequence is dense.
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
  if (version < 5) {
    // v5: replace the legacy 2-block sample program with the 6-week Candito
    // Hybrid + add the trainingMaxes / loadingIncrement fields. The old program
    // has no loadPercentage prescriptions so no Training Maxes prompt is needed
    // for sessions logged against it — but the cursor resets to the start of
    // the new program. Past sessions remain intact; their programDayIds simply
    // won't resolve against the new program (Day-vs-Session diff degrades to
    // "all bonus", which is the documented behaviour after a program swap).
    state.program = canditoHybridProgram;
    // Field was briefly named userMaxes during initial implementation; rename
    // landed before any user ran v5, so we transparently move the value into
    // trainingMaxes if it happens to exist on a persisted-but-unshipped store.
    const s = state as TrainingState & {
      userMaxes?: unknown;
      trainingMaxes?: unknown;
      loadingIncrement?: unknown;
    };
    if (s.trainingMaxes === undefined) {
      s.trainingMaxes = s.userMaxes !== undefined ? s.userMaxes : null;
    }
    delete s.userMaxes;
    if (typeof s.loadingIncrement !== 'number') s.loadingIncrement = 2.5;
  }
  if (version < 6) {
    // v6: introduce `lastReadiness` so a same-day cancel+restart doesn't
    // re-prompt the Readiness check. Existing persisted stores get null —
    // the next submission populates it.
    const s = state as TrainingState & { lastReadiness?: unknown };
    if (s.lastReadiness === undefined) s.lastReadiness = null;
  }
  if (version < 7) {
    // v7: strip seeded/demo sessions so the app starts empty for real use.
    // Only user-logged sessions (id starts with "session-", produced by
    // startSession) are kept; everything else (legacy s1..s5, gen-*, generator
    // output from older v3 migrations) is dropped.
    if (Array.isArray(state.sessions)) {
      state.sessions = state.sessions.filter((s) => s.id.startsWith('session-'));
    }
  }
  return state as TrainingState;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      sessions: [],
      program: canditoHybridProgram,
      activeSession: null,
      restTimerDuration: 120,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,

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
        // Always record the submission on the global "last readiness" slot,
        // even if there's no active session yet — so a same-day cancel +
        // restart can replay it without re-prompting the lifter.
        set({ lastReadiness: { readiness, timestamp: Date.now() } });
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
          // rpe=0 is the unset sentinel per ADR-0006. The lifter must pick an
          // RPE before the set can be marked complete.
          rpe: 0,
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
        // Normalise per ADR-0005 + ADR-0006: drop placeholder sets the lifter
        // never logged, then drop any ExerciseLog whose sets[] is now empty so
        // the Day-vs-Session diff catches it as Prescribed-but-Skipped.
        const cleanedExercises: ExerciseLog[] = [];
        for (const log of activeSession.exercises) {
          const realSets = log.sets.filter(
            (s) => !(s.completed === false && (s.weight === 0 || s.reps === 0)),
          );
          if (realSets.length === 0) continue;
          cleanedExercises.push({ ...log, sets: realSets });
        }
        const finished: Session = {
          ...activeSession,
          exercises: cleanedExercises,
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

      setTrainingMaxes: (maxes) => set({ trainingMaxes: maxes }),

      setLoadingIncrement: (increment) => set({ loadingIncrement: increment }),

      restartProgram: () => {
        const { program } = get();
        set({
          program: {
            ...program,
            currentBlockIndex: 0,
            currentWeekIndex: 0,
            currentDayIndex: 0,
          },
          trainingMaxes: null,
        });
      },

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
      version: 7,
      migrate: (persistedState, version) => migrate(persistedState, version),
    }
  )
);
