export type MuscleGroup =
  | 'Quads'
  | 'Glutes'
  | 'Chest'
  | 'Triceps'
  | 'Back'
  | 'Hamstrings'
  | 'Shoulders'
  | 'Biceps'
  | 'Core'
  | 'Posterior Chain';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  isMainLift: boolean;
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

export interface ProgramBlock {
  id: string;
  name: string;
  weekNumber: number;
  focus: string;
  days: ProgramDay[];
}

export interface Program {
  id: string;
  name: string;
  blocks: ProgramBlock[];
  currentBlockIndex: number;
  currentDayIndex: number;
}

export const MAIN_LIFTS = ['Squat', 'Bench Press', 'Deadlift'] as const;
export type MainLift = typeof MAIN_LIFTS[number];

export function calculateE1RM(weight: number, reps: number, rpe: number): number {
  const effectiveReps = reps + (10 - rpe);
  if (effectiveReps <= 0) return weight;
  return weight / (1.0278 - 0.0278 * effectiveReps);
}

export function getTopSetE1RM(sets: SetLog[]): number {
  const completed = sets.filter(s => s.completed && s.weight > 0 && s.reps > 0);
  if (completed.length === 0) return 0;
  return Math.max(...completed.map(s => calculateE1RM(s.weight, s.reps, s.rpe)));
}
