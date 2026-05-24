export type MuscleGroup =
  // Lower
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Adductors'
  | 'Calves'
  | 'Spinal Erectors'
  // Upper push
  | 'Chest'
  | 'Front Delts'
  | 'Side Delts'
  | 'Triceps'
  // Upper pull
  | 'Lats'
  | 'Upper Back'
  | 'Traps'
  | 'Rear Delts'
  | 'Biceps'
  | 'Forearms'
  // Midsection
  | 'Core';

export type MuscleRegion = 'Lower' | 'Push' | 'Pull' | 'Core';

/**
 * Region grouping used purely for UI sorting/sectioning of muscle filter chips
 * and Progress-tab bars. Not part of the volume math; volume is per-muscle.
 */
export const MUSCLE_REGION: Record<MuscleGroup, MuscleRegion> = {
  Quads: 'Lower',
  Hamstrings: 'Lower',
  Glutes: 'Lower',
  Adductors: 'Lower',
  Calves: 'Lower',
  'Spinal Erectors': 'Lower',
  Chest: 'Push',
  'Front Delts': 'Push',
  'Side Delts': 'Push',
  Triceps: 'Push',
  Lats: 'Pull',
  'Upper Back': 'Pull',
  Traps: 'Pull',
  'Rear Delts': 'Pull',
  Biceps: 'Pull',
  Forearms: 'Pull',
  Core: 'Core',
};

export const MUSCLE_REGION_ORDER: readonly MuscleRegion[] = ['Lower', 'Push', 'Pull', 'Core'];

export const MAIN_LIFTS = ['Squat', 'Bench Press', 'Deadlift'] as const;
export type MainLift = typeof MAIN_LIFTS[number];

export interface Exercise {
  id: string;
  name: string;
  /** Muscles this exercise primarily trains. Each contributes 1.0 working set
   *  toward weekly volume per logged working set. Ordered by emphasis. */
  primaryMuscles: MuscleGroup[];
  /** Muscles trained as stabilisers / secondary movers. Displayed but does NOT
   *  count toward weekly volume — keeps MEV/MAV/MRV bands meaningful. */
  secondaryMuscles?: MuscleGroup[];
  isMainLift: boolean;
  relatedTo?: MainLift;
}

export interface SetLog {
  id: string;
  weight: number;
  reps: number;
  rpe: number;
  timestamp: number;
  completed: boolean;
}

export interface ExerciseLog {
  exercise: Exercise;
  sets: SetLog[];
}

export interface ReadinessCheckIn {
  sleep: number; // 4-10
  energy: number; // 1-5
  soreness: number; // 1-5
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  exercises: ExerciseLog[];
  readiness?: ReadinessCheckIn;
  note?: string;
  programDayId?: string;
  workoutName?: string;
}

export interface SetPrescription {
  sets: number;
  reps: string; // e.g. "5", "8-12", "MR" (max reps to RPE 10)
  rpeTarget?: number;
  /** Percentage of the load basis Training Max (0-100). When set, the app
   *  derives a prescribed weight from the lifter's TrainingMaxes. */
  loadPercentage?: number;
  /** Which main-lift Training Max the percentage is computed against. Defaults
   *  to the exercise itself if it's a main lift, or its `relatedTo` if it's a
   *  variant. */
  loadBasis?: MainLift;
  /** Free-form coach-note tied to this prescription (e.g. MR back-off rule).
   *  Surfaced in the Day Focus sheet so the lifter sees the protocol up-front. */
  notes?: string;
}

/** Three-lift Training Max input that drives all loadPercentage-based
 *  prescriptions. Owned by the lifter, not the program (see ADR-0013). */
export interface TrainingMaxes {
  squat: number;
  bench: number;
  deadlift: number;
}

/** Map an Exercise to the MainLift its 1RM should be computed against.
 *  Returns null for accessories (e.g. lateral raise) that don't have a basis. */
export function exerciseToMainLift(exercise: Exercise): MainLift | null {
  if (exercise.isMainLift) {
    const name = exercise.name;
    if (name === 'Squat' || name === 'Bench Press' || name === 'Deadlift') return name;
  }
  if (exercise.relatedTo) return exercise.relatedTo;
  return null;
}

/** Resolve the 1RM that backs a prescription's percentage. Honours explicit
 *  loadBasis, falls back to the exercise's main-lift mapping. */
export function resolveLoadBasis(
  prescription: SetPrescription,
  exercise: Exercise,
): MainLift | null {
  if (prescription.loadBasis) return prescription.loadBasis;
  return exerciseToMainLift(exercise);
}

export interface ProgramExercise {
  exercise: Exercise;
  prescription: SetPrescription;
}

export interface ProgramDay {
  id: string;
  name: string;
  exercises: ProgramExercise[];
}

export interface ProgramWeek {
  id: string;
  weekNumber: number;
  days: ProgramDay[];
}

export interface ProgramBlock {
  id: string;
  name: string;
  focus: string;
  weeks: ProgramWeek[];
}

export interface Program {
  id: string;
  name: string;
  blocks: ProgramBlock[];
  currentBlockIndex: number;
  currentWeekIndex: number;
  currentDayIndex: number;
}

/**
 * Parse the lower bound of a prescription rep string like "5" or "8-12".
 * Returns null if unparseable (e.g. time-based "60s").
 */
function parsePrescribedRepsLowerBound(reps: string): number | null {
  const match = reps.match(/^(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

export interface SessionDayDiff {
  /** Exercises in the Day's prescription that have no matching ExerciseLog in the Session. */
  skipped: ProgramExercise[];
  /** ExerciseLogs in the Session that aren't in the Day's prescription. */
  bonus: ExerciseLog[];
  /** Completed sets where reps fell short of the prescription's lower bound. */
  missedReps: Array<{
    exercise: Exercise;
    setLog: SetLog;
    prescribedReps: string;
  }>;
}

/**
 * Compare a Session against the Day it was performed for. Pure — no store coupling.
 * "Skipped" means absent from the Session entirely. We never fabricate placeholder sets.
 *
 * Prescriptions and logs are consumed **in order** rather than keyed by
 * `exercise.id`, so a Day that prescribes the same exercise multiple times
 * (ascending triples, MR + back-off, test-day opener/2nd/3rd) diffs correctly
 * — see ADR-0012. Each prescription claims the next unconsumed matching log;
 * unmatched prescriptions become `skipped`, unmatched logs become `bonus`.
 */
export function diffSessionAgainstDay(session: Session, day: ProgramDay): SessionDayDiff {
  // Walk day.exercises in order. For each prescription, claim the earliest
  // session log with a matching exercise id that hasn't already been claimed.
  // This preserves slot identity for duplicates — log[0] pairs with
  // prescription[0], log[1] with prescription[1], regardless of intervening
  // entries.
  const claimedLogIdx = new Set<number>();
  const peToLogIdx: Array<number | null> = day.exercises.map((pe) => {
    for (let i = 0; i < session.exercises.length; i++) {
      if (claimedLogIdx.has(i)) continue;
      if (session.exercises[i].exercise.id === pe.exercise.id) {
        claimedLogIdx.add(i);
        return i;
      }
    }
    return null;
  });

  const skipped: ProgramExercise[] = [];
  day.exercises.forEach((pe, peIdx) => {
    if (peToLogIdx[peIdx] === null) skipped.push(pe);
  });

  const bonus: ExerciseLog[] = [];
  session.exercises.forEach((log, logIdx) => {
    if (!claimedLogIdx.has(logIdx)) bonus.push(log);
  });

  const missedReps: SessionDayDiff['missedReps'] = [];
  day.exercises.forEach((pe, peIdx) => {
    const logIdx = peToLogIdx[peIdx];
    if (logIdx === null) return;
    const log = session.exercises[logIdx];
    const lowerBound = parsePrescribedRepsLowerBound(pe.prescription.reps);
    if (lowerBound === null) return;
    for (const setLog of log.sets) {
      if (!setLog.completed) continue;
      if (setLog.reps > 0 && setLog.reps < lowerBound) {
        missedReps.push({
          exercise: log.exercise,
          setLog,
          prescribedReps: pe.prescription.reps,
        });
      }
    }
  });

  return { skipped, bonus, missedReps };
}
