import { Exercise, SetPrescription, TrainingMaxes, resolveLoadBasis } from '@/types/training';

/**
 * Derive a prescribed weight from a SetPrescription's `loadPercentage` and the
 * lifter's TrainingMaxes. Returns null when the prescription has no percentage,
 * the lifter has not entered their Training Maxes yet, or the prescription's
 * basis lift has no max (shouldn't happen but defensive).
 *
 * Rounds to the nearest `loadingIncrement` (typically 2.5kg). Always rounds
 * down for percentages > 95% to keep PR/test-day attempts conservative — never
 * round 99% to 100%.
 */
export function calculatePrescribedWeight(
  prescription: SetPrescription,
  exercise: Exercise,
  trainingMaxes: TrainingMaxes | null,
  loadingIncrement: number,
): number | null {
  if (prescription.loadPercentage == null) return null;
  if (!trainingMaxes) return null;
  const basis = resolveLoadBasis(prescription, exercise);
  if (!basis) return null;
  const oneRm =
    basis === 'Squat' ? trainingMaxes.squat :
    basis === 'Bench Press' ? trainingMaxes.bench :
    basis === 'Deadlift' ? trainingMaxes.deadlift : null;
  if (oneRm == null || oneRm <= 0) return null;

  const raw = (prescription.loadPercentage / 100) * oneRm;
  const increments = raw / loadingIncrement;
  // Conservative rounding above 95% — never inflate a heavy single into a PR
  // attempt the lifter didn't agree to.
  const rounded =
    prescription.loadPercentage > 95
      ? Math.floor(increments) * loadingIncrement
      : Math.round(increments) * loadingIncrement;
  return rounded;
}

/** True if the program (or any of its blocks/weeks/days) contains at least one
 *  prescription with a loadPercentage. Used to decide whether to prompt for
 *  Training Maxes before letting the lifter start a session. */
export function programRequiresTrainingMaxes(
  program: { blocks: { weeks: { days: { exercises: { prescription: SetPrescription }[] }[] }[] }[] },
): boolean {
  for (const block of program.blocks) {
    for (const week of block.weeks) {
      for (const day of week.days) {
        for (const pe of day.exercises) {
          if (pe.prescription.loadPercentage != null) return true;
        }
      }
    }
  }
  return false;
}
