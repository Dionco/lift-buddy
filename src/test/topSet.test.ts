import { describe, it, expect } from 'vitest';
import { topSetOf, lastTopSet, recentTopSetE1RMs } from '@/lib/topSet';
import { Exercise, Session, SetLog, calculateE1RM } from '@/types/training';

const squat: Exercise = {
  id: 'sq',
  name: 'Squat',
  primaryMuscles: ['Quads', 'Glutes'],
  isMainLift: true,
};

const bench: Exercise = {
  id: 'bp',
  name: 'Bench Press',
  primaryMuscles: ['Chest', 'Front Delts', 'Triceps'],
  isMainLift: true,
};

function set(weight: number, reps: number, rpe: number, completed = true): SetLog {
  return { id: `s-${weight}-${reps}-${rpe}`, weight, reps, rpe, timestamp: 0, completed };
}

function session(startTime: number, exercise: Exercise, sets: SetLog[]): Session {
  return {
    id: `sess-${startTime}`,
    startTime,
    exercises: [{ exercise, sets }],
  };
}

describe('topSetOf', () => {
  it('returns null when no completed sets', () => {
    expect(topSetOf([])).toBeNull();
    expect(topSetOf([set(0, 0, 7, false)])).toBeNull();
  });

  it('skips warmups with weight or reps of 0', () => {
    expect(topSetOf([set(0, 5, 7), set(100, 0, 7)])).toBeNull();
  });

  it('selects the set with the highest e1RM, not the highest weight', () => {
    const heavyLowEffort = set(150, 3, 7); // RPE 7 → 3 RIR
    const lightHighEffort = set(100, 5, 10); // RPE 10 → 0 RIR
    const top = topSetOf([heavyLowEffort, lightHighEffort]);
    // 150 / (1.0278 - 0.0278 * (3 + 3)) ≈ 169.5
    // 100 / (1.0278 - 0.0278 * (5 + 0)) ≈ 113.4
    expect(top).toBe(heavyLowEffort);
  });
});

describe('lastTopSet', () => {
  it('returns null when the exercise has never been completed', () => {
    const sessions: Session[] = [session(1000, bench, [set(80, 5, 8)])];
    expect(lastTopSet(sessions, squat.id)).toBeNull();
  });

  it('returns the top set from the newest matching session', () => {
    const newer = set(120, 3, 8);
    const older = set(110, 5, 9);
    const sessions: Session[] = [
      session(2000, squat, [newer]),
      session(1000, squat, [older]),
    ];
    expect(lastTopSet(sessions, squat.id)).toBe(newer);
  });

  it('skips sessions where the exercise has only warmup/incomplete sets', () => {
    const real = set(100, 5, 8);
    const sessions: Session[] = [
      session(2000, squat, [set(60, 5, 6, false)]),
      session(1000, squat, [real]),
    ];
    expect(lastTopSet(sessions, squat.id)).toBe(real);
  });
});

describe('recentTopSetE1RMs', () => {
  it('returns empty when exercise was never performed', () => {
    expect(recentTopSetE1RMs([], 'sq', 3)).toEqual([]);
  });

  it('caps at the requested limit, newest first', () => {
    const sessions: Session[] = [
      session(3000, squat, [set(120, 3, 8)]),
      session(2000, squat, [set(115, 3, 8)]),
      session(1000, squat, [set(110, 3, 8)]),
      session(500, squat, [set(105, 3, 8)]),
    ];
    const out = recentTopSetE1RMs(sessions, squat.id, 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toBeGreaterThan(out[1]);
    expect(out[1]).toBeGreaterThan(out[2]);
    // Verify the actual e1RM of the newest sample
    expect(out[0]).toBeCloseTo(calculateE1RM(120, 3, 8), 4);
  });
});
