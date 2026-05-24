import { MainLift, Session, TrainingMaxes } from '@/types/training';
import { e1rm, topSet } from '@/lib/e1rm';

const RECENCY_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000; // 8 weeks

const MAIN_LIFT_BY_NAME: Record<string, keyof TrainingMaxes> = {
  Squat: 'squat',
  'Bench Press': 'bench',
  Deadlift: 'deadlift',
};

interface Options {
  /** Reference timestamp for the recency window — injected for testability. */
  now: number;
  /** Rounding granularity for the projected value (typically 2.5kg). */
  loadingIncrement: number;
}

/**
 * Suggest seed values for the Training Maxes editor based on the lifter's
 * recent top-set e1RMs on Squat / Bench Press / Deadlift.
 *
 * Only the three competition lifts contribute — Variations like Paused Squat
 * carry their own (lower) e1RM history per CONTEXT.md and would silently drag
 * the projection down if combined.
 *
 * The window is the trailing 8 weeks (per the grill follow-up). Older
 * sessions are ignored so a restart after a long break doesn't feed stale PRs
 * back into the editor. Within the window the **best** e1RM wins — taking
 * the most recent would let a deload day overwrite peak strength.
 *
 * Returns a `Partial<TrainingMaxes>`: lifts with no qualifying session are
 * simply absent, so the caller can fall through to a blank input.
 */
export function projectTrainingMaxes(
  sessions: Session[],
  { now, loadingIncrement }: Options,
): Partial<TrainingMaxes> {
  const cutoff = now - RECENCY_WINDOW_MS;
  const best: Partial<Record<keyof TrainingMaxes, number>> = {};

  for (const s of sessions) {
    if (s.startTime < cutoff) continue;
    for (const log of s.exercises) {
      // Skip Variations — their e1RM lives on a different chart.
      if (!log.exercise.isMainLift) continue;
      const key = MAIN_LIFT_BY_NAME[log.exercise.name as MainLift];
      if (!key) continue;
      const top = topSet(log.sets);
      if (!top) continue;
      const value = e1rm(top.weight, top.reps, top.rpe);
      if (best[key] == null || value > best[key]!) {
        best[key] = value;
      }
    }
  }

  const result: Partial<TrainingMaxes> = {};
  for (const k of Object.keys(best) as (keyof TrainingMaxes)[]) {
    const raw = best[k]!;
    result[k] = Math.round(raw / loadingIncrement) * loadingIncrement;
  }
  return result;
}
