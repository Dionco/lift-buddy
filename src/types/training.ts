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
  reps: string; // e.g. "5", "8-12"
  rpeTarget?: number;
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
 */
export function diffSessionAgainstDay(session: Session, day: ProgramDay): SessionDayDiff {
  const sessionByExerciseId = new Map(
    session.exercises.map(log => [log.exercise.id, log])
  );
  const dayByExerciseId = new Map(
    day.exercises.map(pe => [pe.exercise.id, pe])
  );

  const skipped: ProgramExercise[] = [];
  for (const pe of day.exercises) {
    if (!sessionByExerciseId.has(pe.exercise.id)) skipped.push(pe);
  }

  const bonus: ExerciseLog[] = [];
  for (const log of session.exercises) {
    if (!dayByExerciseId.has(log.exercise.id)) bonus.push(log);
  }

  const missedReps: SessionDayDiff['missedReps'] = [];
  for (const log of session.exercises) {
    const pe = dayByExerciseId.get(log.exercise.id);
    if (!pe) continue;
    const lowerBound = parsePrescribedRepsLowerBound(pe.prescription.reps);
    if (lowerBound === null) continue;
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
  }

  return { skipped, bonus, missedReps };
}
