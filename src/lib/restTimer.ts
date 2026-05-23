import { Exercise } from '@/types/training';

/**
 * Suggested rest between sets, in seconds. Per `docs/powerlifting-knowledge.md`
 * the training goal — which the rep range determines — drives the band:
 *
 *   - 1–5 reps  (maximal strength)         → 3–5 min  (midpoint 240s)
 *   - 6–8 reps  (strength-hypertrophy)     → 2–4 min  (180s)
 *   - 9–12 reps (hypertrophy)              → 1.5–3 min (150s)
 *   - 13+ reps  (endurance / accessories)  → 1–2 min  (90s)
 *
 * The Deadlift (and Deadlift variations linked via `relatedTo`) get an extra
 * 60s — systemic-fatigue recovery from a heavy pull is the slowest in the
 * sport. RPE is intentionally not used here: the rep range already encodes
 * the training goal, and RPE-based shortening would double-count effort.
 */
export function suggestRest(
  reps: number,
  exercise: Pick<Exercise, 'id' | 'relatedTo'> | undefined,
): number {
  const base = reps <= 5 ? 240 : reps <= 8 ? 180 : reps <= 12 ? 150 : 90;
  const isDeadlift = exercise?.id === 'deadlift' || exercise?.relatedTo === 'deadlift';
  return isDeadlift ? base + 60 : base;
}
