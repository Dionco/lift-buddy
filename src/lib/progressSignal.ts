import { Exercise, Session } from '@/types/training';
import { e1rm, lastTopSet, recentTopSetE1RMs, topSet } from './e1rm';

export type RepRangeBucket = '1-5' | '6-10' | '11+';

export function repRangeBucket(reps: number): RepRangeBucket {
  if (reps <= 5) return '1-5';
  if (reps <= 10) return '6-10';
  return '11+';
}

// ─── Fatigue Signal ────────────────────────────────────────────────────────

export interface FatigueSignal {
  exerciseName: string;
  /** Top-set e1RMs in chronological order (oldest first) — ready for sparkline rendering. */
  e1rms: number[];
  /** Net change from oldest to newest sample. Always negative when this signal fires. */
  delta: number;
}

const FATIGUE_MIN_DECLINE_KG = 1.5;
const FATIGUE_SESSIONS = 3;

/**
 * Per ADR-0008: top-set e1RM declines on a Main Lift across 3+ consecutive sessions.
 *
 * Returns null unless the last three completed sessions for this Exercise show a
 * strict monotone e1RM decline AND the total drop is at least 1.5kg (filters out
 * RPE-jitter noise on otherwise stable e1RMs).
 *
 * The caller decides whether to call this for an Accessory — the rule is well-defined
 * for Main Lifts and heavy variations; on high-rep accessories the underlying e1RMs
 * are noisy and false positives are likely.
 */
export function fatigueSignal(sessions: Session[], exercise: Exercise): FatigueSignal | null {
  const recent = recentTopSetE1RMs(sessions, exercise.id, FATIGUE_SESSIONS);
  if (recent.length < FATIGUE_SESSIONS) return null;
  // recent is newest-first; require strict monotone decline.
  for (let i = 0; i < recent.length - 1; i++) {
    if (!(recent[i] < recent[i + 1])) return null;
  }
  const ordered = recent.slice().reverse();
  const delta = ordered[ordered.length - 1] - ordered[0];
  if (delta > -FATIGUE_MIN_DECLINE_KG) return null;
  return { exerciseName: exercise.name, e1rms: ordered, delta };
}

// ─── Main Lift Progress Signal ─────────────────────────────────────────────

export interface MainLiftProgressSignal {
  trending: 'up' | 'flat' | 'down';
  /** Mean kg of e1RM gain per session within the trailing window. */
  slopeKgPerSession: number;
  /** The rep-range bucket of the most recent top set — slope is only computed within this bucket. */
  bucket: RepRangeBucket;
  /** Sample e1RMs in chronological order (oldest first). */
  e1rms: number[];
  /** Number of Sessions used to compute the slope. */
  windowSessions: number;
}

export interface MainLiftProgressOptions {
  /** Trailing window in weeks. Defaults to 4 (per ADR-0008). */
  weeks?: number;
  /** Minimum number of sessions to fall back to if the time window has too few. Defaults to 6 (per ADR-0008). */
  minSessions?: number;
  /** Slope magnitude (kg/session) below which trend is reported as 'flat'. */
  flatThresholdKg?: number;
  /** Override "now" for deterministic tests. */
  now?: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Per ADR-0008: positive slope of top-set e1RM within a comparable rep range
 * over the trailing window (default: 4 weeks or 6 sessions, whichever is more).
 *
 * The rep-range bucket is locked to the most recent top set's bucket — comparing
 * a 3-rep top-set e1RM against a 10-rep top-set e1RM is forbidden by the ADR.
 *
 * Returns null when there aren't enough same-bucket samples to fit a slope.
 */
export function mainLiftProgressSignal(
  sessions: Session[],
  exercise: Exercise,
  options: MainLiftProgressOptions = {},
): MainLiftProgressSignal | null {
  const weeks = options.weeks ?? 4;
  const minSessions = options.minSessions ?? 6;
  const flatThreshold = options.flatThresholdKg ?? 0.3;
  const now = options.now ?? Date.now();

  type Sample = { timestamp: number; e1rm: number; bucket: RepRangeBucket };
  const samples: Sample[] = [];
  for (const session of sessions) {
    const log = session.exercises.find((e) => e.exercise.id === exercise.id);
    if (!log) continue;
    const top = topSet(log.sets);
    if (!top) continue;
    samples.push({
      timestamp: session.startTime,
      e1rm: e1rm(top.weight, top.reps, top.rpe),
      bucket: repRangeBucket(top.reps),
    });
  }
  if (samples.length < 2) return null;

  // sessions arrive newest-first; samples[0] is the most recent top set.
  const bucket = samples[0].bucket;
  const sameBucket = samples.filter((s) => s.bucket === bucket);

  const cutoff = now - weeks * WEEK_MS;
  const inWindow = sameBucket.filter((s) => s.timestamp >= cutoff);
  const chosen = inWindow.length >= minSessions ? inWindow : sameBucket.slice(0, minSessions);
  if (chosen.length < 2) return null;

  const ordered = chosen.slice().sort((a, b) => a.timestamp - b.timestamp);
  const first = ordered[0].e1rm;
  const last = ordered[ordered.length - 1].e1rm;
  const slope = (last - first) / (ordered.length - 1);

  let trending: 'up' | 'flat' | 'down';
  if (slope > flatThreshold) trending = 'up';
  else if (slope < -flatThreshold) trending = 'down';
  else trending = 'flat';

  return {
    trending,
    slopeKgPerSession: slope,
    bucket,
    e1rms: ordered.map((s) => s.e1rm),
    windowSessions: ordered.length,
  };
}

// ─── Accessory Progress Signal (Double Progression) ────────────────────────

export interface AccessoryProgressSignal {
  trending: 'up' | 'flat' | 'down';
  /** Why we judged it that way. 'reps' = added reps at same weight; 'weight' = added load. */
  reason: 'reps' | 'weight' | 'none';
  previous: { weight: number; reps: number };
  latest: { weight: number; reps: number };
}

const WEIGHT_EPSILON = 0.01;

/**
 * Per ADR-0008 / CONTEXT.md "Double Progression": progress on an accessory means
 * either adding reps within the same prescribed range, or adding load after
 * hitting the top of the range. We approximate this by comparing the latest
 * Top Set against the previous one for the same Exercise:
 *
 *   - heavier weight    → trending up (reason: 'weight')
 *   - same weight, more reps → trending up (reason: 'reps')
 *   - same weight, same reps → flat
 *   - lighter weight, or fewer reps at same weight → trending down
 *
 * Returns null if there aren't two prior Top Sets to compare.
 *
 * Rep-range bracketing isn't enforced here — the lifter's *current* range is
 * implicit in what they actually performed. A swing from 12 reps down to 6 reps
 * with heavier load registers as 'weight' progress, which matches the double-
 * progression intent ("hit the top of the range, then add load and drop back").
 */
export function accessoryProgressSignal(
  sessions: Session[],
  exercise: Exercise,
): AccessoryProgressSignal | null {
  // Walk newest-first, collect the first two completed top sets.
  const tops: Array<{ weight: number; reps: number }> = [];
  for (const s of sessions) {
    const log = s.exercises.find((e) => e.exercise.id === exercise.id);
    if (!log) continue;
    const top = topSet(log.sets);
    if (!top) continue;
    tops.push({ weight: top.weight, reps: top.reps });
    if (tops.length === 2) break;
  }
  if (tops.length < 2) return null;
  const [latest, previous] = tops;

  if (latest.weight - previous.weight > WEIGHT_EPSILON) {
    return { trending: 'up', reason: 'weight', previous, latest };
  }
  if (previous.weight - latest.weight > WEIGHT_EPSILON) {
    return { trending: 'down', reason: 'none', previous, latest };
  }
  if (latest.reps > previous.reps) {
    return { trending: 'up', reason: 'reps', previous, latest };
  }
  if (latest.reps < previous.reps) {
    return { trending: 'down', reason: 'none', previous, latest };
  }
  return { trending: 'flat', reason: 'none', previous, latest };
}

// ─── Convenience dispatch ──────────────────────────────────────────────────

export type ProgressSignalResult =
  | { kind: 'main'; signal: MainLiftProgressSignal }
  | { kind: 'accessory'; signal: AccessoryProgressSignal }
  | null;

/**
 * Returns the canonical Progress Signal for an Exercise, picking the rule by
 * what the lifter has been actually doing:
 *
 *   - Most recent top set in the 1–5 rep bucket → Main Lift e1RM-slope rule
 *     (covers Main Lifts AND heavy work on variations per ADR-0009)
 *   - Anything else → Double Progression
 *
 * This decouples the rule from the `isMainLift` flag, which is editorial only.
 */
export function progressSignal(
  sessions: Session[],
  exercise: Exercise,
  options?: MainLiftProgressOptions,
): ProgressSignalResult {
  const recent = lastTopSet(sessions, exercise.id);
  if (!recent) return null;
  if (repRangeBucket(recent.reps) === '1-5') {
    const signal = mainLiftProgressSignal(sessions, exercise, options);
    return signal ? { kind: 'main', signal } : null;
  }
  const signal = accessoryProgressSignal(sessions, exercise);
  return signal ? { kind: 'accessory', signal } : null;
}
