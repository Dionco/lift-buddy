import { describe, it, expect, beforeEach } from 'vitest';
import { useTrainingStore } from '@/store/useTrainingStore';
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
