import { describe, it, expect } from 'vitest';
import { Exercise, Session, SetLog } from '@/types/training';
import { projectTrainingMaxes } from '@/lib/projectTrainingMaxes';

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

const NOW = 1_700_000_000_000; // arbitrary fixed reference
const WEEK = 7 * 24 * 60 * 60 * 1000;

function set(weight: number, reps: number, rpe: number): SetLog {
  return {
    id: `s-${weight}-${reps}-${rpe}`,
    weight,
    reps,
    rpe,
    timestamp: 0,
    completed: true,
  };
}

function session(
  daysAgo: number,
  exercises: { exercise: Exercise; sets: SetLog[] }[],
): Session {
  return {
    id: `sess-${daysAgo}`,
    startTime: NOW - daysAgo * 24 * 60 * 60 * 1000,
    exercises,
  };
}

describe('projectTrainingMaxes', () => {
  it('returns an empty object when no sessions contain Main Lift top sets in the window', () => {
    const result = projectTrainingMaxes([], { now: NOW, loadingIncrement: 2.5 });
    expect(result).toEqual({});
  });

  it('picks the highest top-set e1RM for each Main Lift within the 8-week window', () => {
    const sessions: Session[] = [
      // Today: lighter squat
      session(1, [{ exercise: squat, sets: [set(140, 3, 8)] }]),
      // 3 weeks ago: heavier squat — should win
      session(21, [{ exercise: squat, sets: [set(160, 3, 9)] }]),
      // Bench somewhere in the window
      session(14, [{ exercise: bench, sets: [set(100, 5, 9)] }]),
      // Deadlift in the window
      session(7, [{ exercise: deadlift, sets: [set(200, 3, 8)] }]),
    ];
    const result = projectTrainingMaxes(sessions, { now: NOW, loadingIncrement: 2.5 });
    // All three Main Lifts should be projected.
    expect(result.squat).toBeDefined();
    expect(result.bench).toBeDefined();
    expect(result.deadlift).toBeDefined();
    // Squat e1RM from 160×3@9 is higher than 140×3@8 — the 3-week-old session wins.
    // Round to nearest 2.5kg.
    expect(result.squat! % 2.5).toBe(0);
    // Sanity bound — the projection must be at least the lifted weight.
    expect(result.squat!).toBeGreaterThanOrEqual(160);
  });

  it('ignores sessions older than the trailing 8-week window', () => {
    const sessions: Session[] = [
      // 12 weeks ago — outside the window even though it was a PR. Stale.
      session(84, [{ exercise: squat, sets: [set(200, 3, 9)] }]),
      // Recent, lighter session.
      session(2, [{ exercise: squat, sets: [set(140, 3, 8)] }]),
    ];
    const result = projectTrainingMaxes(sessions, { now: NOW, loadingIncrement: 2.5 });
    // Should reflect the 140×3, not the stale 200×3.
    expect(result.squat).toBeLessThan(180);
    expect(result.squat).toBeGreaterThanOrEqual(140);
  });

  it('rounds the projected Training Max to the loadingIncrement', () => {
    const sessions: Session[] = [
      session(1, [{ exercise: squat, sets: [set(157.5, 5, 9)] }]),
    ];
    const r2 = projectTrainingMaxes(sessions, { now: NOW, loadingIncrement: 2.5 });
    expect(r2.squat).toBeDefined();
    expect((r2.squat! * 10) % 25).toBe(0); // multiple of 2.5
    const r5 = projectTrainingMaxes(sessions, { now: NOW, loadingIncrement: 5 });
    expect(r5.squat! % 5).toBe(0);
  });

  it('does not project from Variations — Paused Squat does not seed the Squat field', () => {
    // Variations are separate exercises per CONTEXT.md / ADR — combining them
    // would corrupt the projection. The editor's Squat input is for competition
    // Squat e1RM only.
    const sessions: Session[] = [
      session(2, [{ exercise: pausedSquat, sets: [set(160, 3, 9)] }]),
    ];
    const result = projectTrainingMaxes(sessions, { now: NOW, loadingIncrement: 2.5 });
    expect(result.squat).toBeUndefined();
  });

  it('omits a lift entirely when no completed top set is available for it', () => {
    const sessions: Session[] = [
      // Squat present, others absent.
      session(2, [{ exercise: squat, sets: [set(140, 3, 8)] }]),
    ];
    const result = projectTrainingMaxes(sessions, { now: NOW, loadingIncrement: 2.5 });
    expect(result.squat).toBeDefined();
    expect(result.bench).toBeUndefined();
    expect(result.deadlift).toBeUndefined();
  });
});
