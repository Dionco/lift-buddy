import { describe, it, expect } from 'vitest';
import {
  fatigueSignal,
  mainLiftProgressSignal,
  accessoryProgressSignal,
  nextAccessorySuggestion,
  progressSignal,
  repRangeBucket,
} from '@/lib/progressSignal';
import { Exercise, Session, SetLog, SetPrescription } from '@/types/training';

const squat: Exercise = {
  id: 'sq',
  name: 'Squat',
  primaryMuscles: ['Quads', 'Glutes'],
  isMainLift: true,
};

const curl: Exercise = {
  id: 'curl',
  name: 'Bicep Curl',
  primaryMuscles: ['Biceps'],
  isMainLift: false,
};

function set(weight: number, reps: number, rpe: number): SetLog {
  return { id: `${weight}-${reps}-${rpe}`, weight, reps, rpe, timestamp: 0, completed: true };
}

function s(startTime: number, exercise: Exercise, sets: SetLog[]): Session {
  return { id: `s${startTime}`, startTime, exercises: [{ exercise, sets }] };
}

const DAY = 24 * 60 * 60 * 1000;

describe('repRangeBucket', () => {
  it('buckets at 5 and 10', () => {
    expect(repRangeBucket(1)).toBe('1-5');
    expect(repRangeBucket(5)).toBe('1-5');
    expect(repRangeBucket(6)).toBe('6-10');
    expect(repRangeBucket(10)).toBe('6-10');
    expect(repRangeBucket(11)).toBe('11+');
  });
});

describe('fatigueSignal', () => {
  it('returns null with fewer than 3 sessions', () => {
    const sessions = [s(2000, squat, [set(120, 3, 8)]), s(1000, squat, [set(115, 3, 8)])];
    expect(fatigueSignal(sessions, squat)).toBeNull();
  });

  it('returns null when not strictly monotone declining', () => {
    // Newest first: 100, 105, 100 — not monotone decline
    const sessions = [
      s(3000, squat, [set(100, 3, 9)]),
      s(2000, squat, [set(105, 3, 9)]),
      s(1000, squat, [set(100, 3, 9)]),
    ];
    expect(fatigueSignal(sessions, squat)).toBeNull();
  });

  it('returns null when decline is below the magnitude threshold', () => {
    // Tiny strict decline (< 1.5kg total) — not meaningful
    const sessions = [
      s(3000, squat, [set(149.5, 3, 8)]),
      s(2000, squat, [set(150, 3, 8)]),
      s(1000, squat, [set(150.5, 3, 8)]),
    ];
    expect(fatigueSignal(sessions, squat)).toBeNull();
  });

  it('fires on 3 strictly-declining sessions with meaningful drop', () => {
    const sessions = [
      s(3000, squat, [set(140, 3, 9)]),
      s(2000, squat, [set(150, 3, 9)]),
      s(1000, squat, [set(160, 3, 9)]),
    ];
    const sig = fatigueSignal(sessions, squat);
    expect(sig).not.toBeNull();
    expect(sig!.exerciseName).toBe('Squat');
    // Chronological order (oldest first) for sparkline
    expect(sig!.e1rms[0]).toBeGreaterThan(sig!.e1rms[2]);
    expect(sig!.delta).toBeLessThan(-1.5);
  });
});

describe('mainLiftProgressSignal', () => {
  it('returns null with fewer than 2 same-bucket samples', () => {
    const sessions = [s(1000, squat, [set(120, 3, 8)])];
    expect(mainLiftProgressSignal(sessions, squat)).toBeNull();
  });

  it('locks the slope to the most-recent rep-range bucket', () => {
    const now = Date.now();
    // Last session is 3 reps (1-5 bucket); previous sessions mix buckets.
    const sessions = [
      s(now - 1 * DAY, squat, [set(150, 3, 8)]), // 1-5 bucket
      s(now - 8 * DAY, squat, [set(140, 3, 8)]), // 1-5 bucket
      s(now - 15 * DAY, squat, [set(100, 8, 8)]), // 6-10 bucket — must be excluded
    ];
    const sig = mainLiftProgressSignal(sessions, squat, { now, weeks: 4, minSessions: 2 });
    expect(sig).not.toBeNull();
    expect(sig!.bucket).toBe('1-5');
    expect(sig!.windowSessions).toBe(2);
    expect(sig!.trending).toBe('up');
    expect(sig!.slopeKgPerSession).toBeGreaterThan(0);
  });

  it('reports flat when slope is within the threshold', () => {
    const now = Date.now();
    const sessions = [
      s(now - 1 * DAY, squat, [set(120, 3, 8)]),
      s(now - 8 * DAY, squat, [set(120, 3, 8)]),
      s(now - 15 * DAY, squat, [set(120, 3, 8)]),
    ];
    const sig = mainLiftProgressSignal(sessions, squat, { now, weeks: 4, minSessions: 2 });
    expect(sig!.trending).toBe('flat');
  });

  it('falls back to minSessions when the time window is too thin', () => {
    const now = Date.now();
    // Only 1 session inside the 4-week window, but 3 same-bucket sessions exist.
    const sessions = [
      s(now - 2 * DAY, squat, [set(140, 3, 8)]),
      s(now - 60 * DAY, squat, [set(135, 3, 8)]),
      s(now - 90 * DAY, squat, [set(130, 3, 8)]),
    ];
    const sig = mainLiftProgressSignal(sessions, squat, { now, weeks: 4, minSessions: 3 });
    expect(sig).not.toBeNull();
    expect(sig!.windowSessions).toBe(3);
  });
});

describe('accessoryProgressSignal', () => {
  it('returns null with fewer than 2 prior top sets', () => {
    expect(accessoryProgressSignal([s(1, curl, [set(15, 10, 8)])], curl)).toBeNull();
  });

  it('detects added load', () => {
    const sessions = [
      s(2000, curl, [set(17.5, 8, 8)]),
      s(1000, curl, [set(15, 8, 8)]),
    ];
    const sig = accessoryProgressSignal(sessions, curl);
    expect(sig!.trending).toBe('up');
    expect(sig!.reason).toBe('weight');
  });

  it('detects added reps at the same load (double-progression rep step)', () => {
    const sessions = [
      s(2000, curl, [set(15, 12, 8)]),
      s(1000, curl, [set(15, 10, 8)]),
    ];
    const sig = accessoryProgressSignal(sessions, curl);
    expect(sig!.trending).toBe('up');
    expect(sig!.reason).toBe('reps');
  });

  it('reports flat when both weight and reps are unchanged', () => {
    const sessions = [
      s(2000, curl, [set(15, 10, 8)]),
      s(1000, curl, [set(15, 10, 8)]),
    ];
    const sig = accessoryProgressSignal(sessions, curl);
    expect(sig!.trending).toBe('flat');
  });

  it('reports down on dropped weight', () => {
    const sessions = [
      s(2000, curl, [set(12.5, 12, 8)]),
      s(1000, curl, [set(15, 10, 8)]),
    ];
    const sig = accessoryProgressSignal(sessions, curl);
    expect(sig!.trending).toBe('down');
  });
});

describe('nextAccessorySuggestion (ADR-0011 strict double progression)', () => {
  const range812: SetPrescription = { sets: 3, reps: '8-12', rpeTarget: 8 };
  const flat5: SetPrescription = { sets: 3, reps: '5', rpeTarget: 8 };
  const noRpe: SetPrescription = { sets: 3, reps: '8-12' };

  it('returns first-time when there are no prior completed sets', () => {
    expect(nextAccessorySuggestion([], range812)).toEqual({ kind: 'first-time' });
  });

  it('treats placeholder zero-weight rows as no prior data', () => {
    const placeholders: SetLog[] = [
      { id: 'p1', weight: 0, reps: 0, rpe: 8, timestamp: 0, completed: false },
    ];
    expect(nextAccessorySuggestion(placeholders, range812)).toEqual({ kind: 'first-time' });
  });

  it('treats rpe=0 sets (unset sentinel) as no prior data', () => {
    // Even if the lifter typed weight+reps, an RPE-unset set has no effort
    // signal — pretend it never happened.
    const rpeUnset: SetLog[] = [
      { id: 'u1', weight: 15, reps: 12, rpe: 0, timestamp: 0, completed: true },
    ];
    expect(nextAccessorySuggestion(rpeUnset, range812)).toEqual({ kind: 'first-time' });
  });

  it('fires add-load when ALL sets hit upper bound at-or-below rpeTarget', () => {
    const prev = [set(15, 12, 8), set(15, 12, 8), set(15, 12, 8)];
    const out = nextAccessorySuggestion(prev, range812);
    expect(out).toEqual({ kind: 'add-load', previousLoad: 15, previousReps: 12 });
  });

  it('does NOT fire add-load when one set was over the rpe target (effort drift)', () => {
    // All at top reps, but the last set was harder than prescribed — earned by working
    // too hard, not by genuine capacity.
    const prev = [set(15, 12, 8), set(15, 12, 8), set(15, 12, 9)];
    const out = nextAccessorySuggestion(prev, range812);
    expect(out.kind).not.toBe('add-load');
  });

  it('does NOT fire add-load when only some sets hit the top', () => {
    const prev = [set(15, 12, 8), set(15, 11, 8), set(15, 10, 8)];
    const out = nextAccessorySuggestion(prev, range812);
    expect(out).toEqual({ kind: 'add-reps', load: 15, targetReps: 11, rpe: 8 });
  });

  it('does NOT fire add-load when the lifter did fewer than prescribed sets', () => {
    // Two sets, both at top — but prescription called for three.
    const prev = [set(15, 12, 7.5), set(15, 12, 7.5)];
    const out = nextAccessorySuggestion(prev, range812);
    expect(out.kind).not.toBe('add-load');
  });

  it('suggests add-reps clamped at the upper bound when last set is below top', () => {
    const prev = [set(15, 9, 8), set(15, 9, 8), set(15, 9, 8)];
    const out = nextAccessorySuggestion(prev, range812);
    expect(out).toEqual({ kind: 'add-reps', load: 15, targetReps: 10, rpe: 8 });
  });

  it('falls through to match when last set is already at top but rpe drift blocks add-load', () => {
    // First two sets fine, last hit top but at higher RPE — not a load bump, but no
    // room to add reps either.
    const prev = [set(15, 11, 7), set(15, 11, 7), set(15, 12, 9)];
    const out = nextAccessorySuggestion(prev, range812);
    expect(out).toEqual({ kind: 'match', load: 15, reps: 12, rpe: 9 });
  });

  it('treats a single-number prescription as a degenerate range', () => {
    // "5" reps means lower=upper=5. All sets at 5 reps at or below rpeTarget → add-load.
    const prev = [set(100, 5, 7), set(100, 5, 7.5), set(100, 5, 8)];
    const out = nextAccessorySuggestion(prev, flat5);
    expect(out.kind).toBe('add-load');
  });

  it('ignores the RPE constraint when prescription has no rpeTarget', () => {
    // All at top, RPE was 9.5 — but no target was set, so add-load still fires.
    const prev = [set(15, 12, 9.5), set(15, 12, 9.5), set(15, 12, 9.5)];
    const out = nextAccessorySuggestion(prev, noRpe);
    expect(out.kind).toBe('add-load');
  });

  it('tolerates the en-dash variant in the prescription string', () => {
    const enDash: SetPrescription = { sets: 3, reps: '8–12', rpeTarget: 8 };
    const prev = [set(15, 9, 8), set(15, 9, 8), set(15, 9, 8)];
    const out = nextAccessorySuggestion(prev, enDash);
    expect(out).toEqual({ kind: 'add-reps', load: 15, targetReps: 10, rpe: 8 });
  });
});

describe('progressSignal dispatch', () => {
  it('routes 1-5 rep work through mainLiftProgressSignal', () => {
    const now = Date.now();
    const sessions = [
      s(now - 1 * DAY, squat, [set(150, 3, 8)]),
      s(now - 8 * DAY, squat, [set(140, 3, 8)]),
    ];
    const out = progressSignal(sessions, squat, { now, weeks: 4, minSessions: 2 });
    expect(out?.kind).toBe('main');
  });

  it('routes higher-rep work through accessoryProgressSignal', () => {
    const sessions = [
      s(2000, curl, [set(17.5, 10, 8)]),
      s(1000, curl, [set(15, 10, 8)]),
    ];
    const out = progressSignal(sessions, curl);
    expect(out?.kind).toBe('accessory');
  });

  it('returns null when there is no prior top set', () => {
    expect(progressSignal([], curl)).toBeNull();
  });
});
