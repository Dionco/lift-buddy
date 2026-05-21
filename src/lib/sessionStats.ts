import { Session, SetLog } from '@/types/training';

/**
 * Mean RPE across the completed Sets in `sets`, or null if none are completed.
 * The one place "average RPE of a set list" is computed — callers format the
 * number themselves (rounding is a presentation concern, not a domain one).
 */
export function avgRpe(sets: SetLog[]): number | null {
  const rpes = sets.filter((s) => s.completed).map((s) => s.rpe);
  if (rpes.length === 0) return null;
  return rpes.reduce((a, b) => a + b, 0) / rpes.length;
}

export interface SessionStats {
  /** Count of completed Sets across every exercise in the Session. */
  completedSets: number;
  /** Σ weight × reps over completed Sets. Gross tonnage — not working-set Volume. */
  totalVolume: number;
  /** Mean RPE across completed Sets, or null if the Session has none. */
  avgRpe: number | null;
  /** Wall-clock minutes from start to end, or null if the Session has no endTime. */
  durationMinutes: number | null;
}

/**
 * The canonical per-Session rollup. Describes one Session — no cross-Session
 * aggregation (that's `computeWeeklyVolume`'s job). Pure; no store coupling.
 */
export function sessionStats(session: Session): SessionStats {
  const allSets = session.exercises.flatMap((ex) => ex.sets);
  const completed = allSets.filter((s) => s.completed);
  return {
    completedSets: completed.length,
    totalVolume: completed.reduce((sum, s) => sum + s.weight * s.reps, 0),
    avgRpe: avgRpe(allSets),
    durationMinutes:
      session.endTime != null
        ? Math.round((session.endTime - session.startTime) / 60000)
        : null,
  };
}
