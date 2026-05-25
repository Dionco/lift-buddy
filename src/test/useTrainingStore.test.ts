import { describe, it, expect, beforeEach } from 'vitest';
import { useTrainingStore, ExerciseLogInput } from '@/store/useTrainingStore';
import { Exercise, ExerciseLog, SetLog } from '@/types/training';

const squat: Exercise = {
  id: 'sq',
  name: 'Squat',
  primaryMuscles: ['Quads', 'Glutes'],
  isMainLift: true,
};
const legPress: Exercise = {
  id: 'lp',
  name: 'Leg Press',
  primaryMuscles: ['Quads', 'Glutes'],
  isMainLift: false,
};

function placeholder(weight = 0, reps = 0): SetLog {
  return { id: `ph-${weight}-${reps}`, weight, reps, rpe: 8, timestamp: 0, completed: false };
}
function logged(weight: number, reps: number, rpe = 8): SetLog {
  return { id: `lg-${weight}-${reps}`, weight, reps, rpe, timestamp: 1, completed: true };
}

beforeEach(() => {
  // Reset only the volatile slices the tests touch; leave seed sessions intact.
  useTrainingStore.setState({ activeSession: null });
});

describe('finishSession normalisation (ADR-0005 + ADR-0006)', () => {
  it('drops placeholder zero-weight sets and keeps logged ones', () => {
    const sessionsBefore = useTrainingStore.getState().sessions.length;
    const exercises: ExerciseLog[] = [
      {
        exercise: squat,
        sets: [logged(100, 5), logged(100, 5), placeholder()],
      },
    ];
    useTrainingStore.getState().startSession('Test', 'day-1', exercises);
    useTrainingStore.getState().finishSession();

    const sessions = useTrainingStore.getState().sessions;
    expect(sessions.length).toBe(sessionsBefore + 1);
    const saved = sessions[0];
    expect(saved.exercises).toHaveLength(1);
    expect(saved.exercises[0].sets).toHaveLength(2);
    expect(saved.exercises[0].sets.every((s) => s.completed)).toBe(true);
  });

  it('drops ExerciseLogs whose sets are all placeholders (swap-out case)', () => {
    // ADR-0005 example: lifter swaps Squat for Leg Press. Squat row is left
    // untouched (all placeholder), Leg Press gets real sets.
    const exercises: ExerciseLog[] = [
      { exercise: squat, sets: [placeholder(), placeholder(), placeholder()] },
      { exercise: legPress, sets: [logged(200, 8), logged(200, 8), logged(200, 8)] },
    ];
    useTrainingStore.getState().startSession('Test', 'day-1', exercises);
    useTrainingStore.getState().finishSession();

    const saved = useTrainingStore.getState().sessions[0];
    expect(saved.exercises.map((e) => e.exercise.id)).toEqual(['lp']);
  });

  it('drops placeholders where weight was entered but reps were not', () => {
    const exercises: ExerciseLog[] = [
      {
        exercise: squat,
        // Lifter typed weight then walked away — reps still 0, completed false.
        sets: [logged(100, 5), { ...placeholder(100, 0) }],
      },
    ];
    useTrainingStore.getState().startSession('Test', 'day-1', exercises);
    useTrainingStore.getState().finishSession();

    const saved = useTrainingStore.getState().sessions[0];
    expect(saved.exercises[0].sets).toHaveLength(1);
  });
});

describe('ExerciseLog.id (stable per-log identity)', () => {
  it('startSession assigns a unique id to every input log', () => {
    const exercises: ExerciseLogInput[] = [
      { exercise: squat, sets: [placeholder()] },
      { exercise: legPress, sets: [placeholder()] },
      { exercise: squat, sets: [placeholder()] }, // duplicate exercise on purpose
    ];
    useTrainingStore.getState().startSession('Test', 'day-1', exercises);
    const logs = useTrainingStore.getState().activeSession!.exercises;
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => typeof l.id === 'string' && l.id.length > 0)).toBe(true);
    const ids = new Set(logs.map((l) => l.id));
    expect(ids.size).toBe(3); // all unique, even for the duplicate exercise
  });

  it('addExercise assigns an id to the inserted log', () => {
    useTrainingStore.getState().startSession('Test', 'day-1', [
      { exercise: squat, sets: [placeholder()] },
    ]);
    useTrainingStore.getState().addExercise({ exercise: legPress, sets: [] });
    const logs = useTrainingStore.getState().activeSession!.exercises;
    expect(logs).toHaveLength(2);
    expect(typeof logs[1].id).toBe('string');
    expect(logs[1].id.length).toBeGreaterThan(0);
    expect(logs[1].id).not.toBe(logs[0].id);
  });

  it('v8 migration backfills ids on persisted logs that lack them', () => {
    // Simulate v7 persisted state: ExerciseLog with no `id` field.
    const v7State = {
      sessions: [
        {
          id: 'session-1',
          startTime: 1,
          endTime: 2,
          exercises: [
            { exercise: squat, sets: [logged(100, 5)] },
            { exercise: legPress, sets: [logged(200, 8)] },
          ],
        },
      ],
      activeSession: {
        id: 'session-2',
        startTime: 3,
        exercises: [{ exercise: squat, sets: [placeholder()] }],
      },
      program: useTrainingStore.getState().program,
      restTimerDuration: 120,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,
    };

    // Pull the migrate function out of the persist config and run it.
    const migrated = (useTrainingStore.persist.getOptions().migrate as
      | ((state: unknown, version: number) => unknown)
      | undefined)?.(v7State, 7) as typeof v7State;

    expect(migrated).toBeTruthy();
    expect(migrated.sessions[0].exercises.every((l: ExerciseLog) => typeof l.id === 'string' && l.id.length > 0)).toBe(true);
    expect(migrated.activeSession!.exercises.every((l: ExerciseLog) => typeof l.id === 'string' && l.id.length > 0)).toBe(true);

    const allIds = [
      ...migrated.sessions[0].exercises.map((l: ExerciseLog) => l.id),
      ...migrated.activeSession!.exercises.map((l: ExerciseLog) => l.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length); // all unique
  });
});
