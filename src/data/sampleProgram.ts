import { Exercise, Program, ProgramBlock } from '@/types/training';

export const EXERCISES: Record<string, Exercise> = {
  // Main Lifts
  squat: { id: 'squat', name: 'Squat', muscleGroup: 'Quads', isMainLift: true },
  bench: { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest', isMainLift: true },
  deadlift: { id: 'deadlift', name: 'Deadlift', muscleGroup: 'Posterior Chain', isMainLift: true },

  // Squat variations
  pausedSquat: { id: 'pausedSquat', name: 'Paused Squat', muscleGroup: 'Quads', isMainLift: false, relatedTo: 'Squat' },
  tempoSquat: { id: 'tempoSquat', name: 'Tempo Squat', muscleGroup: 'Quads', isMainLift: false, relatedTo: 'Squat' },
  ssbSquat: { id: 'ssbSquat', name: 'SSB Squat', muscleGroup: 'Quads', isMainLift: false, relatedTo: 'Squat' },

  // Bench variations
  closeGripBench: { id: 'closeGripBench', name: 'Close-Grip Bench', muscleGroup: 'Triceps', isMainLift: false, relatedTo: 'Bench Press' },
  pausedBench: { id: 'pausedBench', name: 'Paused Bench', muscleGroup: 'Chest', isMainLift: false, relatedTo: 'Bench Press' },
  inclineBench: { id: 'inclineBench', name: 'Incline Bench', muscleGroup: 'Chest', isMainLift: false, relatedTo: 'Bench Press' },

  // Deadlift variations
  sumoDeadlift: { id: 'sumoDeadlift', name: 'Sumo Deadlift', muscleGroup: 'Posterior Chain', isMainLift: false, relatedTo: 'Deadlift' },
  deficitDeadlift: { id: 'deficitDeadlift', name: 'Deficit Deadlift', muscleGroup: 'Posterior Chain', isMainLift: false, relatedTo: 'Deadlift' },
  rdl: { id: 'rdl', name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', isMainLift: false, relatedTo: 'Deadlift' },

  // Other accessories
  legPress: { id: 'legPress', name: 'Leg Press', muscleGroup: 'Quads', isMainLift: false },
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
    id: 'b1',
    name: 'Accumulation',
    focus: 'Volume',
    weeks: [
      {
        id: 'b1w1',
        weekNumber: 1,
        days: [
          {
            id: 'b1w1d1', name: 'Day 1 — Squat & Upper Push',
            exercises: [
              { exercise: EXERCISES.squat, prescription: { sets: 4, reps: '10', rpeTarget: 7 } },
              { exercise: EXERCISES.bench, prescription: { sets: 4, reps: '10', rpeTarget: 7 } },
              { exercise: EXERCISES.dips, prescription: { sets: 3, reps: '12', rpeTarget: 7 } },
              { exercise: EXERCISES.lateralRaise, prescription: { sets: 3, reps: '15' } },
            ],
          },
          {
            id: 'b1w1d2', name: 'Day 2 — Deadlift & Upper Pull',
            exercises: [
              { exercise: EXERCISES.deadlift, prescription: { sets: 3, reps: '8', rpeTarget: 7 } },
              { exercise: EXERCISES.barbellRow, prescription: { sets: 4, reps: '10', rpeTarget: 7 } },
              { exercise: EXERCISES.pullUp, prescription: { sets: 3, reps: '8-12' } },
              { exercise: EXERCISES.bicepCurl, prescription: { sets: 3, reps: '12' } },
            ],
          },
          {
            id: 'b1w1d3', name: 'Day 3 — Legs & Core',
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
        id: 'b1w2',
        weekNumber: 2,
        days: [
          {
            id: 'b1w2d1', name: 'Day 1 — Squat & Accessories',
            exercises: [
              { exercise: EXERCISES.squat, prescription: { sets: 5, reps: '8', rpeTarget: 7.5 } },
              { exercise: EXERCISES.legPress, prescription: { sets: 4, reps: '10' } },
              { exercise: EXERCISES.legCurl, prescription: { sets: 3, reps: '12' } },
              { exercise: EXERCISES.calfRaise, prescription: { sets: 3, reps: '15' } },
            ],
          },
          {
            id: 'b1w2d2', name: 'Day 2 — Bench & Upper',
            exercises: [
              { exercise: EXERCISES.bench, prescription: { sets: 5, reps: '8', rpeTarget: 7.5 } },
              { exercise: EXERCISES.overheadPress, prescription: { sets: 4, reps: '8' } },
              { exercise: EXERCISES.dips, prescription: { sets: 3, reps: '10-15' } },
              { exercise: EXERCISES.lateralRaise, prescription: { sets: 3, reps: '15' } },
            ],
          },
          {
            id: 'b1w2d3', name: 'Day 3 — Deadlift & Back',
            exercises: [
              { exercise: EXERCISES.deadlift, prescription: { sets: 4, reps: '6', rpeTarget: 7.5 } },
              { exercise: EXERCISES.barbellRow, prescription: { sets: 4, reps: '8' } },
              { exercise: EXERCISES.pullUp, prescription: { sets: 4, reps: '8-12' } },
              { exercise: EXERCISES.bicepCurl, prescription: { sets: 3, reps: '12' } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'b2',
    name: 'Intensification',
    focus: 'Strength',
    weeks: [
      {
        id: 'b2w1',
        weekNumber: 1,
        days: [
          {
            id: 'b2w1d1', name: 'Day 1 — Squat & Accessories',
            exercises: [
              { exercise: EXERCISES.squat, prescription: { sets: 5, reps: '5', rpeTarget: 8 } },
              { exercise: EXERCISES.legPress, prescription: { sets: 3, reps: '8' } },
              { exercise: EXERCISES.rdl, prescription: { sets: 3, reps: '8', rpeTarget: 7.5 } },
            ],
          },
          {
            id: 'b2w1d2', name: 'Day 2 — Bench & Upper',
            exercises: [
              { exercise: EXERCISES.bench, prescription: { sets: 5, reps: '5', rpeTarget: 8 } },
              { exercise: EXERCISES.overheadPress, prescription: { sets: 3, reps: '6' } },
              { exercise: EXERCISES.barbellRow, prescription: { sets: 4, reps: '6', rpeTarget: 7.5 } },
            ],
          },
          {
            id: 'b2w1d3', name: 'Day 3 — Deadlift & Accessories',
            exercises: [
              { exercise: EXERCISES.deadlift, prescription: { sets: 5, reps: '3', rpeTarget: 8.5 } },
              { exercise: EXERCISES.pullUp, prescription: { sets: 3, reps: '6-10' } },
              { exercise: EXERCISES.plank, prescription: { sets: 3, reps: '60s' } },
            ],
          },
        ],
      },
      {
        id: 'b2w2',
        weekNumber: 2,
        days: [
          {
            id: 'b2w2d1', name: 'Day 1 — Squat Peak',
            exercises: [
              { exercise: EXERCISES.squat, prescription: { sets: 5, reps: '2-3', rpeTarget: 9 } },
              { exercise: EXERCISES.legPress, prescription: { sets: 2, reps: '6' } },
            ],
          },
          {
            id: 'b2w2d2', name: 'Day 2 — Bench Peak',
            exercises: [
              { exercise: EXERCISES.bench, prescription: { sets: 5, reps: '2-3', rpeTarget: 9 } },
              { exercise: EXERCISES.dips, prescription: { sets: 2, reps: '8' } },
            ],
          },
          {
            id: 'b2w2d3', name: 'Day 3 — Deadlift Peak',
            exercises: [
              { exercise: EXERCISES.deadlift, prescription: { sets: 5, reps: '1-2', rpeTarget: 9.5 } },
              { exercise: EXERCISES.barbellRow, prescription: { sets: 2, reps: '6' } },
            ],
          },
        ],
      },
    ],
  },
];

export const sampleProgram: Program = {
  id: 'prog1',
  name: '4-Week Powerlifting Block',
  blocks,
  currentBlockIndex: 1,
  currentWeekIndex: 0,
  currentDayIndex: 1,
};
