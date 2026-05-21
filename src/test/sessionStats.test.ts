import { describe, it, expect } from 'vitest';
import { avgRpe, sessionStats } from '@/lib/sessionStats';
import { Exercise, Session, SetLog } from '@/types/training';

const squat: Exercise = {
  id: 'sq',
  name: 'Squat',
  primaryMuscles: ['Quads', 'Glutes'],
  isMainLift: true,
};

const curl: Exercise = {
  id: 'cu',
  name: 'Biceps Curl',
  primaryMuscles: ['Biceps'],
  isMainLift: false,
};

function set(weight: number, reps: number, rpe: number, completed = true): SetLog {
  return { id: `s-${weight}-${reps}-${rpe}-${completed}`, weight, reps, rpe, timestamp: 0, completed };
}

function session(opts: { start?: number; end?: number; exercises: { exercise: Exercise; sets: SetLog[] }[] }): Session {
  return {
    id: 'sess',
    startTime: opts.start ?? 0,
    endTime: opts.end,
    exercises: opts.exercises,
  };
}

describe('avgRpe', () => {
  it('returns null when no sets are completed', () => {
    expect(avgRpe([])).toBeNull();
    expect(avgRpe([set(100, 5, 8, false)])).toBeNull();
  });

  it('averages RPE across completed sets only', () => {
    const sets = [set(100, 5, 8), set(100, 5, 10), set(100, 5, 6, false)];
    expect(avgRpe(sets)).toBe(9);
  });
});

describe('sessionStats', () => {
  it('counts only completed sets', () => {
    const s = session({
      exercises: [{ exercise: squat, sets: [set(100, 5, 8), set(100, 5, 9), set(100, 5, 7, false)] }],
    });
    expect(sessionStats(s).completedSets).toBe(2);
  });

  it('sums weight × reps over completed sets as total volume', () => {
    const s = session({
      exercises: [
        { exercise: squat, sets: [set(100, 5, 8), set(120, 3, 9)] },
        { exercise: curl, sets: [set(20, 10, 8), set(20, 10, 8, false)] },
      ],
    });
    // 100×5 + 120×3 + 20×10 = 500 + 360 + 200 = 1060
    expect(sessionStats(s).totalVolume).toBe(1060);
  });

  it('averages RPE across every completed set in the session', () => {
    const s = session({
      exercises: [
        { exercise: squat, sets: [set(100, 5, 8)] },
        { exercise: curl, sets: [set(20, 10, 10)] },
      ],
    });
    expect(sessionStats(s).avgRpe).toBe(9);
  });

  it('reports duration in whole minutes from start to end', () => {
    const s = session({ start: 0, end: 90 * 60000, exercises: [] });
    expect(sessionStats(s).durationMinutes).toBe(90);
  });

  it('returns null duration when the session has no endTime', () => {
    const s = session({ start: 0, exercises: [] });
    expect(sessionStats(s).durationMinutes).toBeNull();
  });

  it('returns a zeroed rollup for an empty session', () => {
    const s = session({ exercises: [] });
    expect(sessionStats(s)).toEqual({
      completedSets: 0,
      totalVolume: 0,
      avgRpe: null,
      durationMinutes: null,
    });
  });
});
