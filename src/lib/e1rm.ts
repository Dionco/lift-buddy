import { Session, SetLog } from '@/types/training';

/**
 * Estimated 1-Rep Max (e1RM) from a single non-maximal set.
 * See CONTEXT.md → e1RM. Most accurate at 1–5 reps; error grows above 10 reps.
 *
 * `weight / (1.0278 - 0.0278 × (reps + (10 - rpe)))`
 *
 * The scalar formula is the one primitive every other e1RM function in the app
 * is built on — it lives here and nowhere else.
 */
export function e1rm(weight: number, reps: number, rpe: number): number {
  const effectiveReps = reps + (10 - rpe);
  if (effectiveReps <= 0) return weight;
  return weight / (1.0278 - 0.0278 * effectiveReps);
}

/**
 * The Top Set within a single ExerciseLog: the completed Set with the highest e1RM.
 * Returns null if no Set is completed (or all are warmups with weight/reps of 0).
 */
export function topSet(sets: SetLog[]): SetLog | null {
  const completed = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (completed.length === 0) return null;
  return completed.reduce(
    (best, s) => (e1rm(s.weight, s.reps, s.rpe) >= e1rm(best.weight, best.reps, best.rpe) ? s : best),
    completed[0],
  );
}

/**
 * The e1RM of the Top Set within an ExerciseLog, or 0 if there is no completed Set.
 * The "highest e1RM" rule lives in `topSet` — this is just its e1RM read off.
 */
export function topSetE1rm(sets: SetLog[]): number {
  const top = topSet(sets);
  return top ? e1rm(top.weight, top.reps, top.rpe) : 0;
}

/**
 * The most recent Top Set for an Exercise across the lifter's Session history.
 * Sessions are scanned newest-first; the first Session that contains the Exercise
 * with at least one completed Set wins.
 */
export function lastTopSet(sessions: Session[], exerciseId: string): SetLog | null {
  for (const s of sessions) {
    const log = s.exercises.find((e) => e.exercise.id === exerciseId);
    if (!log) continue;
    const top = topSet(log.sets);
    if (top) return top;
  }
  return null;
}

/**
 * Top-set e1RMs for an Exercise across recent Sessions, newest first, capped at `limit`.
 * Sessions where the Exercise wasn't performed (or had no completed sets) are skipped.
 * Used by Fatigue Signal and Progress Signal calculations.
 */
export function recentTopSetE1RMs(sessions: Session[], exerciseId: string, limit: number): number[] {
  const out: number[] = [];
  for (const s of sessions) {
    if (out.length >= limit) break;
    const log = s.exercises.find((e) => e.exercise.id === exerciseId);
    if (!log) continue;
    const top = topSet(log.sets);
    if (!top) continue;
    out.push(e1rm(top.weight, top.reps, top.rpe));
  }
  return out;
}
