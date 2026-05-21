import { describe, it, expect } from 'vitest';
import {
  computeWeeklyVolume,
  computePlannedWeeklyVolume,
  classifyVolume,
  isWorkingSet,
  weekStart,
  VOLUME_LANDMARKS,
} from '@/lib/volume';
import { Exercise, Program, Session, SetLog } from '@/types/training';

const squat: Exercise = {
  id: 'sq',
  name: 'Squat',
  primaryMuscles: ['Quads', 'Glutes'],
  secondaryMuscles: ['Adductors', 'Spinal Erectors'],
  isMainLift: true,
};

const curl: Exercise = {
  id: 'curl',
  name: 'Bicep Curl',
  primaryMuscles: ['Biceps'],
  isMainLift: false,
};

function set(weight: number, reps: number, rpe: number, completed = true): SetLog {
  return { id: `${weight}-${reps}-${rpe}`, weight, reps, rpe, timestamp: 0, completed };
}

function s(startTime: number, exercise: Exercise, sets: SetLog[]): Session {
  return { id: `s${startTime}`, startTime, exercises: [{ exercise, sets }] };
}

describe('isWorkingSet', () => {
  it('counts only completed sets at RPE ≥ 7 with non-zero load and reps', () => {
    expect(isWorkingSet(set(100, 5, 8))).toBe(true);
    expect(isWorkingSet(set(100, 5, 7))).toBe(true);
    expect(isWorkingSet(set(100, 5, 6))).toBe(false); // sub-threshold RPE → not a working set
    expect(isWorkingSet(set(100, 5, 8, false))).toBe(false); // not completed
    expect(isWorkingSet(set(0, 5, 8))).toBe(false); // bodyweight/empty placeholder
    expect(isWorkingSet(set(100, 0, 8))).toBe(false); // skipped reps
  });
});

describe('classifyVolume', () => {
  const lm = { mev: 8, mav: 14, mrv: 20 };

  it('returns unknown when no landmarks are defined', () => {
    expect(classifyVolume(10)).toBe('unknown');
  });

  it('bands across all four states', () => {
    expect(classifyVolume(7, lm)).toBe('below-mev');
    expect(classifyVolume(8, lm)).toBe('in-mav'); // MEV is inclusive
    expect(classifyVolume(14, lm)).toBe('in-mav'); // MAV is inclusive
    expect(classifyVolume(15, lm)).toBe('near-mrv');
    expect(classifyVolume(20, lm)).toBe('near-mrv'); // MRV is inclusive
    expect(classifyVolume(21, lm)).toBe('over-mrv');
  });
});

describe('weekStart', () => {
  it('snaps a mid-week date to the preceding Monday at 00:00', () => {
    // Wednesday 2026-03-25 14:30
    const wed = new Date(2026, 2, 25, 14, 30);
    const monday = weekStart(wed);
    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getDate()).toBe(23);
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
  });

  it('snaps a Sunday to the *preceding* Monday (start of that week)', () => {
    // Sunday 2026-03-29
    const sun = new Date(2026, 2, 29, 10, 0);
    const monday = weekStart(sun);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(23);
  });

  it('honours weekOffset', () => {
    const ref = new Date(2026, 2, 25);
    const lastWeek = weekStart(ref, -1);
    expect(lastWeek.getDate()).toBe(16);
  });
});

describe('computeWeeklyVolume', () => {
  const now = new Date(2026, 2, 25, 12, 0); // Wed 2026-03-25
  const monday = weekStart(now);
  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 1);

  it('returns the Monday–Sunday window', () => {
    const v = computeWeeklyVolume([], { now });
    expect(v.start.getDay()).toBe(1);
    expect(v.end.getDay()).toBe(0); // Sunday
    expect(v.end.getHours()).toBe(23);
  });

  it('counts only working sets (RPE ≥ 7) per muscle group', () => {
    const sessions = [
      s(tuesday.getTime(), squat, [
        set(60, 5, 6), // warmup-ish — excluded
        set(120, 5, 8), // working set
        set(120, 5, 9), // working set
      ]),
    ];
    const v = computeWeeklyVolume(sessions, { now });
    // Squat's primaryMuscles is ['Quads', 'Glutes'] — both increment per working set.
    expect(v.perMuscleGroup.Quads).toBe(2);
    expect(v.perMuscleGroup.Glutes).toBe(2);
  });

  it('default contribution credits every primary muscle of a compound lift', () => {
    // A single Squat working set should bump BOTH Quads and Glutes by 1 with
    // no `contributesTo` override — proves the multi-muscle default is wired in.
    const sessions = [s(tuesday.getTime(), squat, [set(120, 5, 8)])];
    const v = computeWeeklyVolume(sessions, { now });
    expect(v.perMuscleGroup.Quads).toBe(1);
    expect(v.perMuscleGroup.Glutes).toBe(1);
    // Secondaries (Adductors, Spinal Erectors) MUST NOT be credited by default.
    expect(v.perMuscleGroup.Adductors).toBeUndefined();
    expect(v.perMuscleGroup['Spinal Erectors']).toBeUndefined();
  });

  it('totalKg includes every completed set with load (any RPE)', () => {
    const sessions = [
      s(tuesday.getTime(), squat, [
        set(60, 5, 6), // 300
        set(120, 5, 8), // 600
      ]),
    ];
    const v = computeWeeklyVolume(sessions, { now });
    expect(v.totalKg).toBe(900);
  });

  it('excludes sessions outside the target week', () => {
    const lastWeek = new Date(monday);
    lastWeek.setDate(monday.getDate() - 3);
    const sessions = [
      s(lastWeek.getTime(), squat, [set(120, 5, 8)]),
      s(tuesday.getTime(), squat, [set(120, 5, 8)]),
    ];
    const v = computeWeeklyVolume(sessions, { now });
    expect(v.perMuscleGroup.Quads).toBe(1);
  });

  it('weekOffset selects an earlier week', () => {
    const lastWeek = new Date(monday);
    lastWeek.setDate(monday.getDate() - 5);
    const sessions = [s(lastWeek.getTime(), squat, [set(120, 5, 8)])];
    const v = computeWeeklyVolume(sessions, { now, weekOffset: -1 });
    expect(v.perMuscleGroup.Quads).toBe(1);
  });

  it('contributesTo override replaces the exercise primaryMuscles default', () => {
    // Override forces a single-muscle credit, bypassing primaryMuscles entirely.
    const sessions = [s(tuesday.getTime(), squat, [set(120, 5, 8), set(120, 5, 8)])];
    const v = computeWeeklyVolume(sessions, {
      now,
      contributesTo: (id) => (id === 'sq' ? ['Quads'] : undefined),
    });
    expect(v.perMuscleGroup.Quads).toBe(2);
    expect(v.perMuscleGroup.Glutes).toBeUndefined();
  });

  it('default contribution uses Exercise.primaryMuscles', () => {
    const sessions = [s(tuesday.getTime(), curl, [set(15, 10, 8)])];
    const v = computeWeeklyVolume(sessions, { now });
    expect(v.perMuscleGroup.Biceps).toBe(1);
    expect(v.perMuscleGroup.Quads).toBeUndefined();
  });
});

describe('computePlannedWeeklyVolume', () => {
  function program(currentBlockIndex: number, currentWeekIndex: number, days: Array<{ exercises: Array<{ exercise: Exercise; prescription: { sets: number; reps: string; rpeTarget?: number } }> }>): Program {
    return {
      id: 'p',
      name: 'P',
      blocks: [
        {
          id: 'b1',
          name: 'b1',
          focus: 'Volume',
          weeks: [
            {
              id: 'b1w1',
              weekNumber: 1,
              days: days.map((d, i) => ({ id: `d${i}`, name: `Day ${i + 1}`, exercises: d.exercises })),
            },
          ],
        },
      ],
      currentBlockIndex,
      currentWeekIndex,
      currentDayIndex: 0,
    };
  }

  it('sums prescribed sets per primary muscle in the current week', () => {
    const p = program(0, 0, [
      { exercises: [{ exercise: squat, prescription: { sets: 4, reps: '5', rpeTarget: 8 } }] },
      { exercises: [{ exercise: curl, prescription: { sets: 3, reps: '10' } }] },
    ]);
    const planned = computePlannedWeeklyVolume(p);
    // Squat → Quads + Glutes, both get 4 sets.
    expect(planned.Quads).toBe(4);
    expect(planned.Glutes).toBe(4);
    // Curl → Biceps, 3 sets.
    expect(planned.Biceps).toBe(3);
    // Squat secondaries (Adductors / Spinal Erectors) MUST NOT be counted.
    expect(planned.Adductors).toBeUndefined();
    expect(planned['Spinal Erectors']).toBeUndefined();
  });

  it('returns empty object when program is undefined or cursor is out of range', () => {
    expect(computePlannedWeeklyVolume(undefined)).toEqual({});
    const p = program(0, 99, []);
    expect(computePlannedWeeklyVolume(p)).toEqual({});
  });

  it('contributesTo override replaces primaryMuscles for planned counts', () => {
    const p = program(0, 0, [
      { exercises: [{ exercise: squat, prescription: { sets: 4, reps: '5' } }] },
    ]);
    const planned = computePlannedWeeklyVolume(p, {
      contributesTo: (id) => (id === 'sq' ? ['Quads'] : undefined),
    });
    expect(planned.Quads).toBe(4);
    expect(planned.Glutes).toBeUndefined();
  });
});

describe('VOLUME_LANDMARKS', () => {
  it('defines mev < mav < mrv for every entry', () => {
    for (const [group, lm] of Object.entries(VOLUME_LANDMARKS)) {
      if (!lm) continue;
      expect(lm.mev, group).toBeLessThanOrEqual(lm.mav);
      expect(lm.mav, group).toBeLessThan(lm.mrv);
    }
  });
});
