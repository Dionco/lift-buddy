import { Exercise, Program, ProgramBlock } from '@/types/training';

export const EXERCISES: Record<string, Exercise> = {
  squat: { id: 'squat', name: 'Squat', muscleGroup: 'Quads', isMainLift: true },
  bench: { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest', isMainLift: true },
  deadlift: { id: 'deadlift', name: 'Deadlift', muscleGroup: 'Posterior Chain', isMainLift: true },
  legPress: { id: 'legPress', name: 'Leg Press', muscleGroup: 'Quads', isMainLift: false },
  rdl: { id: 'rdl', name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', isMainLift: false },
  overheadPress: { id: 'ohp', name: 'Overhead Press', muscleGroup: 'Shoulders', isMainLift: false },
  barbellRow: { id: 'row', name: 'Barbell Row', muscleGroup: 'Back', isMainLift: false },
  pullUp: { id: 'pullup', name: 'Pull-ups', muscleGroup: 'Back', isMainLift: false },
  dips: { id: 'dips', name: 'Dips', muscleGroup: 'Triceps', isMainLift: false },
  legCurl: { id: 'legcurl', name: 'Leg Curl', muscleGroup: 'Hamstrings', isMainLift: false },
  calfRaise: { id: 'calfraise', name: 'Calf Raise', muscleGroup: 'Quads', isMainLift: false },
  lateralRaise: { id: 'latraise', name: 'Lateral Raise', muscleGroup: 'Shoulders', isMainLift: false },
  bicepCurl: { id: 'curl', name: 'Bicep Curl', muscleGroup: 'Biceps', isMainLift: false },
  plank: { id: 'plank', name: 'Plank', muscleGroup: 'Core', isMainLift: false },
};

const blocks: ProgramBlock[] = [
  {
    id: 'b1', name: 'Muscular Conditioning', weekNumber: 1, focus: 'General Prep',
    days: [
      {
        id: 'b1d1', name: 'Day 1 — Squat & Upper Push',
        exercises: [
          { exercise: EXERCISES.squat, prescription: { sets: 4, reps: '10', rpeTarget: 7 } },
          { exercise: EXERCISES.bench, prescription: { sets: 4, reps: '10', rpeTarget: 7 } },
          { exercise: EXERCISES.dips, prescription: { sets: 3, reps: '12', rpeTarget: 7 } },
          { exercise: EXERCISES.lateralRaise, prescription: { sets: 3, reps: '15' } },
        ],
      },
      {
        id: 'b1d2', name: 'Day 2 — Deadlift & Upper Pull',
        exercises: [
          { exercise: EXERCISES.deadlift, prescription: { sets: 3, reps: '8', rpeTarget: 7 } },
          { exercise: EXERCISES.barbellRow, prescription: { sets: 4, reps: '10', rpeTarget: 7 } },
          { exercise: EXERCISES.pullUp, prescription: { sets: 3, reps: '8-12' } },
          { exercise: EXERCISES.bicepCurl, prescription: { sets: 3, reps: '12' } },
        ],
      },
      {
        id: 'b1d3', name: 'Day 3 — Legs & Core',
        exercises: [
          { exercise: EXERCISES.legPress, prescription: { sets: 4, reps: '12', rpeTarget: 7 } },
          { exercise: EXERCISES.rdl, prescription: { sets: 3, reps: '10', rpeTarget: 7 } },
          { exercise: EXERCISES.legCurl, prescription: { sets: 3, reps: '12' } },
          { exercise: EXERCISES.plank, prescription: { sets: 3, reps: '60s' } },
        ],
      },
    ],
  },
  {
    id: 'b2', name: 'Hypertrophy', weekNumber: 2, focus: 'Volume',
    days: [
      {
        id: 'b2d1', name: 'Day 1 — Squat & Accessories',
        exercises: [
          { exercise: EXERCISES.squat, prescription: { sets: 5, reps: '8', rpeTarget: 7.5 } },
          { exercise: EXERCISES.legPress, prescription: { sets: 4, reps: '10' } },
          { exercise: EXERCISES.legCurl, prescription: { sets: 3, reps: '12' } },
          { exercise: EXERCISES.calfRaise, prescription: { sets: 3, reps: '15' } },
        ],
      },
      {
        id: 'b2d2', name: 'Day 2 — Bench & Upper',
        exercises: [
          { exercise: EXERCISES.bench, prescription: { sets: 5, reps: '8', rpeTarget: 7.5 } },
          { exercise: EXERCISES.overheadPress, prescription: { sets: 4, reps: '8' } },
          { exercise: EXERCISES.dips, prescription: { sets: 3, reps: '10-15' } },
          { exercise: EXERCISES.lateralRaise, prescription: { sets: 3, reps: '15' } },
        ],
      },
      {
        id: 'b2d3', name: 'Day 3 — Deadlift & Back',
        exercises: [
          { exercise: EXERCISES.deadlift, prescription: { sets: 4, reps: '6', rpeTarget: 7.5 } },
          { exercise: EXERCISES.barbellRow, prescription: { sets: 4, reps: '8' } },
          { exercise: EXERCISES.pullUp, prescription: { sets: 4, reps: '8-12' } },
          { exercise: EXERCISES.bicepCurl, prescription: { sets: 3, reps: '12' } },
        ],
      },
    ],
  },
  {
    id: 'b3', name: 'Strength', weekNumber: 3, focus: 'Intensity',
    days: [
      {
        id: 'b3d1', name: 'Day 1 — Squat & Accessories',
        exercises: [
          { exercise: EXERCISES.squat, prescription: { sets: 5, reps: '5', rpeTarget: 8 } },
          { exercise: EXERCISES.legPress, prescription: { sets: 3, reps: '8' } },
          { exercise: EXERCISES.rdl, prescription: { sets: 3, reps: '8', rpeTarget: 7.5 } },
        ],
      },
      {
        id: 'b3d2', name: 'Day 2 — Bench & Upper',
        exercises: [
          { exercise: EXERCISES.bench, prescription: { sets: 5, reps: '5', rpeTarget: 8 } },
          { exercise: EXERCISES.overheadPress, prescription: { sets: 3, reps: '6' } },
          { exercise: EXERCISES.barbellRow, prescription: { sets: 4, reps: '6', rpeTarget: 7.5 } },
        ],
      },
      {
        id: 'b3d3', name: 'Day 3 — Deadlift & Accessories',
        exercises: [
          { exercise: EXERCISES.deadlift, prescription: { sets: 5, reps: '3', rpeTarget: 8.5 } },
          { exercise: EXERCISES.pullUp, prescription: { sets: 3, reps: '6-10' } },
          { exercise: EXERCISES.plank, prescription: { sets: 3, reps: '60s' } },
        ],
      },
    ],
  },
  {
    id: 'b4', name: 'Peaking', weekNumber: 4, focus: 'Max Effort',
    days: [
      {
        id: 'b4d1', name: 'Day 1 — Squat Peak',
        exercises: [
          { exercise: EXERCISES.squat, prescription: { sets: 5, reps: '2-3', rpeTarget: 9 } },
          { exercise: EXERCISES.legPress, prescription: { sets: 2, reps: '6' } },
        ],
      },
      {
        id: 'b4d2', name: 'Day 2 — Bench Peak',
        exercises: [
          { exercise: EXERCISES.bench, prescription: { sets: 5, reps: '2-3', rpeTarget: 9 } },
          { exercise: EXERCISES.dips, prescription: { sets: 2, reps: '8' } },
        ],
      },
      {
        id: 'b4d3', name: 'Day 3 — Deadlift Peak',
        exercises: [
          { exercise: EXERCISES.deadlift, prescription: { sets: 5, reps: '1-2', rpeTarget: 9.5 } },
          { exercise: EXERCISES.barbellRow, prescription: { sets: 2, reps: '6' } },
        ],
      },
    ],
  },
];

export const sampleProgram: Program = {
  id: 'prog1',
  name: '4-Week Powerlifting Block',
  blocks,
  currentBlockIndex: 2,
  currentDayIndex: 1,
};
