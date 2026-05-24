import { describe, it, expect } from 'vitest';
import {
  Exercise,
  ProgramDay,
  Session,
  SetLog,
  diffSessionAgainstDay,
} from '@/types/training';

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

const curl: Exercise = {
  id: 'cu',
  name: 'Curl',
  primaryMuscles: ['Biceps'],
  isMainLift: false,
};

function set(reps: number, completed = true, rpe = 8, weight = 100): SetLog {
  return {
    id: `s-${reps}-${weight}-${rpe}-${completed}`,
    weight,
    reps,
    rpe,
    timestamp: 0,
    completed,
  };
}

function session(exercises: { exercise: Exercise; sets: SetLog[] }[]): Session {
  return { id: 'sess', startTime: 0, exercises };
}

describe('diffSessionAgainstDay — sequential consumption of duplicate prescriptions (ADR-0012)', () => {
  it('reports no skips and no bonus when adjacent duplicate prescriptions are all logged', () => {
    // Mirrors Candito Hybrid Week 4 Day 1: ascending squat triples — three
    // separate prescriptions for the same exercise.
    const day: ProgramDay = {
      id: 'd1',
      name: 'Ascending Squat',
      exercises: [
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 88 } },
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 90 } },
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 92 } },
      ],
    };
    const s = session([
      { exercise: squat, sets: [set(3, true, 8, 140)] },
      { exercise: squat, sets: [set(3, true, 8.5, 145)] },
      { exercise: squat, sets: [set(3, true, 9, 150)] },
    ]);

    const diff = diffSessionAgainstDay(s, day);

    expect(diff.skipped).toEqual([]);
    expect(diff.bonus).toEqual([]);
    expect(diff.missedReps).toEqual([]);
  });

  it('flags exactly the unlogged duplicate prescriptions when only some are logged', () => {
    // Lifter only did the first two ascending triples; bailed before the third.
    const day: ProgramDay = {
      id: 'd1',
      name: 'Ascending Squat',
      exercises: [
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 88 } },
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 90 } },
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 92 } },
      ],
    };
    const s = session([
      { exercise: squat, sets: [set(3, true, 8, 140)] },
      { exercise: squat, sets: [set(3, true, 8.5, 145)] },
    ]);

    const diff = diffSessionAgainstDay(s, day);

    expect(diff.skipped).toHaveLength(1);
    expect(diff.skipped[0].exercise.id).toBe('sq');
    // The skipped slot is the third (92%) prescription — the tail of the
    // duplicate run, since slots are consumed in order.
    expect(diff.skipped[0].prescription.loadPercentage).toBe(92);
    expect(diff.bonus).toEqual([]);
    expect(diff.missedReps).toEqual([]);
  });

  it('reports missed-reps against the matched prescription slot, not a later duplicate', () => {
    // Two prescriptions, one short on reps. The diff should report missed-reps
    // against the slot the log was consumed into — not whatever happens to
    // survive in a Map.
    const day: ProgramDay = {
      id: 'd1',
      name: 'Ascending Squat',
      exercises: [
        // Lower bound = 5 reps
        { exercise: squat, prescription: { sets: 1, reps: '5', loadPercentage: 80 } },
        // Lower bound = 3 reps — would NOT trigger a missed-reps flag if the
        // diff confused which slot owns the short set.
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 90 } },
      ],
    };
    const s = session([
      // Logged at the first slot, fell short of 5 reps.
      { exercise: squat, sets: [set(4, true, 9, 120)] },
      // Logged at the second slot, hit 3.
      { exercise: squat, sets: [set(3, true, 9, 140)] },
    ]);

    const diff = diffSessionAgainstDay(s, day);

    expect(diff.skipped).toEqual([]);
    expect(diff.bonus).toEqual([]);
    expect(diff.missedReps).toHaveLength(1);
    expect(diff.missedReps[0].setLog.reps).toBe(4);
    expect(diff.missedReps[0].prescribedReps).toBe('5');
  });
});

describe('diffSessionAgainstDay — unique exercises (regression coverage)', () => {
  it('still flags skipped exercises that have no matching log', () => {
    const day: ProgramDay = {
      id: 'd1',
      name: 'Mixed',
      exercises: [
        { exercise: squat, prescription: { sets: 3, reps: '5' } },
        { exercise: bench, prescription: { sets: 3, reps: '5' } },
      ],
    };
    const s = session([{ exercise: squat, sets: [set(5)] }]);
    const diff = diffSessionAgainstDay(s, day);
    expect(diff.skipped.map((pe) => pe.exercise.id)).toEqual(['bp']);
    expect(diff.bonus).toEqual([]);
  });

  it('still flags bonus exercises that have no matching prescription', () => {
    const day: ProgramDay = {
      id: 'd1',
      name: 'Squat day',
      exercises: [{ exercise: squat, prescription: { sets: 3, reps: '5' } }],
    };
    const s = session([
      { exercise: squat, sets: [set(5)] },
      { exercise: curl, sets: [set(10)] },
    ]);
    const diff = diffSessionAgainstDay(s, day);
    expect(diff.skipped).toEqual([]);
    expect(diff.bonus.map((log) => log.exercise.id)).toEqual(['cu']);
  });

  it('reports a bonus when a duplicate-prescribed exercise is logged more times than prescribed', () => {
    // Day asks for 2 squat slots; lifter logs 3 — the third is a bonus.
    const day: ProgramDay = {
      id: 'd1',
      name: 'Squat day',
      exercises: [
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 88 } },
        { exercise: squat, prescription: { sets: 1, reps: '3', loadPercentage: 92 } },
      ],
    };
    const s = session([
      { exercise: squat, sets: [set(3)] },
      { exercise: squat, sets: [set(3)] },
      { exercise: squat, sets: [set(3)] },
    ]);
    const diff = diffSessionAgainstDay(s, day);
    expect(diff.skipped).toEqual([]);
    expect(diff.bonus).toHaveLength(1);
    expect(diff.bonus[0].exercise.id).toBe('sq');
  });
});
