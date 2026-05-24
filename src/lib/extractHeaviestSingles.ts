import { Session, TrainingMaxes } from '@/types/training';

const MAIN_LIFT_KEY: Record<string, keyof TrainingMaxes> = {
  Squat: 'squat',
  'Bench Press': 'bench',
  Deadlift: 'deadlift',
};

/**
 * Heaviest completed single (`reps === 1`) per Main Lift in a single Session,
 * rounded **down** to the loading increment.
 *
 * Used to seed the Training Max editor at the end of a peaking block — the
 * lifter's 3rd-attempt singles map directly onto the new baseline. We round
 * down (never up) for the same reason `calculatePrescribedWeight` does:
 * never inflate a number the lifter didn't explicitly agree to.
 *
 * Variations (Paused Squat, Close-Grip Bench, etc.) do not contribute —
 * Training Max is for the competition lift only. Lifts with no qualifying
 * single in the Session are absent from the result so the caller can fall
 * back to a blank input.
 */
export function extractHeaviestSingles(
  session: Session,
  loadingIncrement: number,
): Partial<TrainingMaxes> {
  const result: Partial<TrainingMaxes> = {};
  for (const log of session.exercises) {
    if (!log.exercise.isMainLift) continue;
    const key = MAIN_LIFT_KEY[log.exercise.name];
    if (!key) continue;
    let heaviest = 0;
    for (const s of log.sets) {
      if (!s.completed) continue;
      if (s.reps !== 1) continue;
      if (s.weight > heaviest) heaviest = s.weight;
    }
    if (heaviest > 0) {
      result[key] = Math.floor(heaviest / loadingIncrement) * loadingIncrement;
    }
  }
  return result;
}
