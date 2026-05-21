import { Session, SetLog, calculateE1RM } from '@/types/training';

/**
 * The Top Set within a single ExerciseLog: the completed Set with the highest e1RM.
 * Returns null if no Set is completed (or all are warmups with weight/reps of 0).
 */
export function topSetOf(sets: SetLog[]): SetLog | null {
  const completed = sets.filter((s) => s.completed && s.weight > 0 && s.reps > 0);
  if (completed.length === 0) return null;
  return completed.reduce(
    (best, s) =>
      calculateE1RM(s.weight, s.reps, s.rpe) >= calculateE1RM(best.weight, best.reps, best.rpe)
        ? s
        : best,
    completed[0],
  );
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
    const top = topSetOf(log.sets);
    if (top) return top;
  }
  return null;
}

/**
 * Top-set e1RMs for an Exercise across recent Sessions, newest first, capped at `limit`.
 * Sessions where the Exercise wasn't performed (or had no completed sets) are skipped.
 * Used by Fatigue Signal and Progress Signal calculations.
 */
export function recentTopSetE1RMs(
  sessions: Session[],
  exerciseId: string,
  limit: number,
): number[] {
  const out: number[] = [];
  for (const s of sessions) {
    if (out.length >= limit) break;
    const log = s.exercises.find((e) => e.exercise.id === exerciseId);
    if (!log) continue;
    const top = topSetOf(log.sets);
    if (!top) continue;
    out.push(calculateE1RM(top.weight, top.reps, top.rpe));
  }
  return out;
}
