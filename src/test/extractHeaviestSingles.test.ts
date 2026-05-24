import { describe, it, expect } from 'vitest';
import { Exercise, Session, SetLog } from '@/types/training';
import { extractHeaviestSingles } from '@/lib/extractHeaviestSingles';

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
const deadlift: Exercise = {
  id: 'dl',
  name: 'Deadlift',
  primaryMuscles: ['Glutes', 'Hamstrings', 'Spinal Erectors'],
  isMainLift: true,
};
const pausedSquat: Exercise = {
  id: 'ps',
  name: 'Paused Squat',
  primaryMuscles: ['Quads', 'Glutes'],
  isMainLift: false,
  relatedTo: 'Squat',
};
const curl: Exercise = {
  id: 'cu',
  name: 'Curl',
  primaryMuscles: ['Biceps'],
  isMainLift: false,
};

function set(weight: number, reps: number, completed = true): SetLog {
  return { id: `s-${weight}-${reps}-${completed}`, weight, reps, rpe: 9, timestamp: 0, completed };
}

function session(exercises: { exercise: Exercise; sets: SetLog[] }[]): Session {
  return { id: 'sess', startTime: 0, exercises };
}

describe('extractHeaviestSingles', () => {
  it('returns the heaviest completed single per Main Lift', () => {
    const s = session([
      // Squat: opener 180, 2nd 195, 3rd 205 — all singles, all completed.
      { exercise: squat, sets: [set(180, 1), set(195, 1), set(205, 1)] },
      { exercise: bench, sets: [set(120, 1), set(125, 1)] },
      { exercise: deadlift, sets: [set(220, 1)] },
    ]);
    const result = extractHeaviestSingles(s, 2.5);
    expect(result.squat).toBe(205);
    expect(result.bench).toBe(125);
    expect(result.deadlift).toBe(220);
  });

  it('rounds down to the loading increment, never up', () => {
    const s = session([
      // 201kg single rounds to 200kg with 2.5kg plates (never up to 202.5).
      { exercise: squat, sets: [set(201, 1)] },
      // 122.5 is already a multiple of 2.5 — unchanged.
      { exercise: bench, sets: [set(122.5, 1)] },
    ]);
    const result = extractHeaviestSingles(s, 2.5);
    expect(result.squat).toBe(200);
    expect(result.bench).toBe(122.5);

    // 5kg increment: 201 → 200, 122.5 → 120.
    const r5 = extractHeaviestSingles(s, 5);
    expect(r5.squat).toBe(200);
    expect(r5.bench).toBe(120);
  });

  it('ignores incomplete sets', () => {
    const s = session([
      // The heavier 220 single failed (not completed) — the heaviest completed
      // single is the 200.
      { exercise: squat, sets: [set(200, 1, true), set(220, 1, false)] },
    ]);
    const result = extractHeaviestSingles(s, 2.5);
    expect(result.squat).toBe(200);
  });

  it('ignores non-single sets (back-off doubles, triples, MR sets)', () => {
    const s = session([
      // Top single + a back-off triple at higher absolute weight on the
      // hypothetical case shouldn't promote the triple over the single.
      { exercise: squat, sets: [set(200, 1), set(180, 3), set(160, 5)] },
    ]);
    const result = extractHeaviestSingles(s, 2.5);
    expect(result.squat).toBe(200);
  });

  it('skips Variations — Paused Squat does not contribute to the squat field', () => {
    const s = session([
      { exercise: pausedSquat, sets: [set(180, 1)] },
    ]);
    const result = extractHeaviestSingles(s, 2.5);
    expect(result.squat).toBeUndefined();
  });

  it('skips accessories entirely', () => {
    const s = session([{ exercise: curl, sets: [set(30, 1)] }]);
    expect(extractHeaviestSingles(s, 2.5)).toEqual({});
  });

  it('omits a lift when no completed single is present', () => {
    const s = session([
      // Squat: only logged a triple, no single.
      { exercise: squat, sets: [set(180, 3)] },
      // Bench has a single.
      { exercise: bench, sets: [set(120, 1)] },
    ]);
    const result = extractHeaviestSingles(s, 2.5);
    expect(result.squat).toBeUndefined();
    expect(result.bench).toBe(120);
  });
});
