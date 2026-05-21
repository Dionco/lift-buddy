import { MuscleGroup, Program, Session, SetLog } from '@/types/training';

/**
 * Per-muscle-group weekly volume landmarks (per Mike Israetel, in working sets/week):
 *  - mev (Minimum Effective Volume): below this, no progress.
 *  - mav (Maximum Adaptive Volume): the optimal range upper bound.
 *  - mrv (Maximum Recoverable Volume): the ceiling — above this, recovery is compromised.
 *
 * Numeric ranges live here, not in `CONTEXT.md` (per `docs/powerlifting-knowledge.md`'s framing).
 * If the lifter wants to tune them, this is the single edit site.
 */
export interface VolumeLandmarks {
  mev: number;
  mav: number;
  mrv: number;
}

export const VOLUME_LANDMARKS: Partial<Record<MuscleGroup, VolumeLandmarks>> = {
  // Lower
  Quads: { mev: 8, mav: 14, mrv: 20 },
  Hamstrings: { mev: 6, mav: 10, mrv: 16 },
  Glutes: { mev: 4, mav: 12, mrv: 16 },
  Adductors: { mev: 0, mav: 8, mrv: 16 },
  Calves: { mev: 6, mav: 12, mrv: 20 },
  'Spinal Erectors': { mev: 4, mav: 10, mrv: 16 },
  // Upper push
  Chest: { mev: 8, mav: 14, mrv: 22 },
  // Front delts get most of their volume from bench/OHP/dips, so direct work
  // is rarely needed — MEV 0.
  'Front Delts': { mev: 0, mav: 8, mrv: 16 },
  'Side Delts': { mev: 8, mav: 16, mrv: 26 },
  Triceps: { mev: 6, mav: 12, mrv: 18 },
  // Upper pull
  Lats: { mev: 8, mav: 14, mrv: 22 },
  'Upper Back': { mev: 8, mav: 14, mrv: 22 },
  Traps: { mev: 0, mav: 8, mrv: 20 },
  'Rear Delts': { mev: 6, mav: 14, mrv: 24 },
  Biceps: { mev: 6, mav: 12, mrv: 18 },
  Forearms: { mev: 0, mav: 6, mrv: 14 },
  // Midsection
  Core: { mev: 0, mav: 8, mrv: 16 },
};

export type VolumeStatus = 'below-mev' | 'in-mav' | 'near-mrv' | 'over-mrv' | 'unknown';

/**
 * Banding against the MEV/MAV/MRV landmarks (CONTEXT.md):
 *   - below-mev: under-stimulating
 *   - in-mav:    on-target — the productive range
 *   - near-mrv:  approaching the ceiling — still productive, watch fatigue
 *   - over-mrv:  past the ceiling — recovery debt is likely
 *   - unknown:   no landmarks defined for this muscle group
 */
export function classifyVolume(sets: number, landmarks?: VolumeLandmarks): VolumeStatus {
  if (!landmarks) return 'unknown';
  if (sets < landmarks.mev) return 'below-mev';
  if (sets <= landmarks.mav) return 'in-mav';
  if (sets <= landmarks.mrv) return 'near-mrv';
  return 'over-mrv';
}

/**
 * The working-set rule (CONTEXT.md): a set counts toward weekly volume iff it
 * was completed at RPE ≥ 7 with non-zero weight and reps. Warmups, rep-out
 * cooldowns, and skipped sets are excluded.
 */
export function isWorkingSet(set: SetLog): boolean {
  return set.completed && set.rpe >= 7 && set.weight > 0 && set.reps > 0;
}

/**
 * The list of muscle groups a single working set contributes toward.
 * Default: the Exercise's `primaryMuscles`.
 *
 * Compound lifts contribute to each of their primary muscles (a Squat working
 * set counts for both Quads and Glutes). Secondary muscles are display-only —
 * they don't count toward weekly volume. Callers can supply a custom mapping
 * via `computeWeeklyVolume`'s `contributesTo` option as an override (e.g. tests
 * or future per-user tweaks).
 */
export type ContributesTo = (exerciseId: string) => MuscleGroup[] | undefined;

export interface WeeklyVolume {
  /** Monday 00:00 local time of the target week. */
  start: Date;
  /** Sunday 23:59:59.999 local time of the target week. */
  end: Date;
  /** Working-set counts per muscle group. Empty groups omitted. */
  perMuscleGroup: Partial<Record<MuscleGroup, number>>;
  /** Total weight×reps across every completed set in the week (any RPE). */
  totalKg: number;
}

export interface WeeklyVolumeOptions {
  /** Override "now" for deterministic tests. */
  now?: Date;
  /** Week relative to "now" — 0 = this week, -1 = last week, etc. Default 0. */
  weekOffset?: number;
  /**
   * Optional override mapping an exercise id to the muscle groups its working
   * sets count for. When omitted (or returns undefined for an id), the
   * exercise's own `muscleGroup` is used.
   */
  contributesTo?: ContributesTo;
}

/** Monday 00:00 local time for the week containing `reference`, plus `offset` weeks. */
export function weekStart(reference: Date, offset = 0): Date {
  const d = new Date(reference);
  // JavaScript's getDay(): Sun=0..Sat=6. Map to Mon=0..Sun=6.
  const mondayDelta = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayDelta + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Compute weekly volume for the week containing `now + weekOffset` weeks.
 * Pure: no store coupling, no I/O, derives entirely from the inputs.
 */
export function computeWeeklyVolume(
  sessions: Session[],
  options: WeeklyVolumeOptions = {},
): WeeklyVolume {
  const reference = options.now ?? new Date();
  const offset = options.weekOffset ?? 0;
  const start = weekStart(reference, offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const startMs = start.getTime();
  const endMs = end.getTime();

  const perMuscleGroup: Partial<Record<MuscleGroup, number>> = {};
  let totalKg = 0;

  for (const session of sessions) {
    if (session.startTime < startMs || session.startTime > endMs) continue;

    for (const log of session.exercises) {
      const targets =
        options.contributesTo?.(log.exercise.id) ?? log.exercise.primaryMuscles;

      for (const set of log.sets) {
        if (!set.completed) continue;
        if (set.weight > 0 && set.reps > 0) {
          totalKg += set.weight * set.reps;
        }
        if (!isWorkingSet(set)) continue;
        for (const group of targets) {
          perMuscleGroup[group] = (perMuscleGroup[group] ?? 0) + 1;
        }
      }
    }
  }

  return { start, end, perMuscleGroup, totalKg: Math.round(totalKg) };
}

export interface PlannedWeeklyVolumeOptions {
  /**
   * Optional override mapping an exercise id → primary muscles, mirroring
   * `WeeklyVolumeOptions.contributesTo`. Default falls back to the exercise's
   * own `primaryMuscles`.
   */
  contributesTo?: ContributesTo;
}

/**
 * Sum of prescribed sets per primary muscle for the program's *current* week
 * (`program.currentBlockIndex` / `currentWeekIndex`). Pure projection of what
 * the lifter is signed up to do — the planned counterpart to
 * `computeWeeklyVolume`'s done counts.
 *
 * Every prescribed set on a Program Exercise is counted toward each of its
 * primary muscles (secondaries don't count, mirroring done-volume rules).
 * Time-based prescriptions like "60s" still contribute their `sets` count —
 * the rep string is not consulted.
 */
export function computePlannedWeeklyVolume(
  program: Program | undefined,
  options: PlannedWeeklyVolumeOptions = {},
): Partial<Record<MuscleGroup, number>> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  if (!program) return out;
  const block = program.blocks[program.currentBlockIndex];
  if (!block) return out;
  const week = block.weeks[program.currentWeekIndex];
  if (!week) return out;
  for (const day of week.days) {
    for (const pe of day.exercises) {
      const targets =
        options.contributesTo?.(pe.exercise.id) ?? pe.exercise.primaryMuscles;
      for (const m of targets) {
        out[m] = (out[m] ?? 0) + pe.prescription.sets;
      }
    }
  }
  return out;
}
