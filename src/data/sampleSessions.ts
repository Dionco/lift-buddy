import { Session } from '@/types/training';
import { EXERCISES } from './sampleProgram';

const day = (daysAgo: number) => Date.now() - daysAgo * 86400000;

export const sampleSessions: Session[] = [
  {
    id: 's1',
    startTime: day(14),
    endTime: day(14) + 4800000,
    workoutName: 'Week 1 · Day 1 — Squat & Upper Push',
    readiness: { sleep: 7.5, energy: 4, soreness: 2 },
    exercises: [
      {
        exercise: EXERCISES.squat,
        sets: [
          { id: 'set1', weight: 100, reps: 10, rpe: 7, timestamp: day(14) + 600000, completed: true },
          { id: 'set2', weight: 100, reps: 10, rpe: 7.5, timestamp: day(14) + 900000, completed: true },
          { id: 'set3', weight: 105, reps: 8, rpe: 8, timestamp: day(14) + 1200000, completed: true },
          { id: 'set4', weight: 105, reps: 8, rpe: 8.5, timestamp: day(14) + 1500000, completed: true },
        ],
      },
      {
        exercise: EXERCISES.bench,
        sets: [
          { id: 'set5', weight: 70, reps: 10, rpe: 7, timestamp: day(14) + 2000000, completed: true },
          { id: 'set6', weight: 70, reps: 10, rpe: 7, timestamp: day(14) + 2300000, completed: true },
          { id: 'set7', weight: 72.5, reps: 8, rpe: 7.5, timestamp: day(14) + 2600000, completed: true },
          { id: 'set8', weight: 72.5, reps: 8, rpe: 8, timestamp: day(14) + 2900000, completed: true },
        ],
      },
    ],
  },
  {
    id: 's2',
    startTime: day(12),
    endTime: day(12) + 4200000,
    workoutName: 'Week 1 · Day 2 — Deadlift & Upper Pull',
    readiness: { sleep: 6, energy: 3, soreness: 3 },
    exercises: [
      {
        exercise: EXERCISES.deadlift,
        sets: [
          { id: 'set9', weight: 140, reps: 8, rpe: 7, timestamp: day(12) + 600000, completed: true },
          { id: 'set10', weight: 145, reps: 6, rpe: 7.5, timestamp: day(12) + 1000000, completed: true },
          { id: 'set11', weight: 145, reps: 6, rpe: 8, timestamp: day(12) + 1400000, completed: true },
        ],
      },
      {
        exercise: EXERCISES.barbellRow,
        sets: [
          { id: 'set12', weight: 70, reps: 10, rpe: 7, timestamp: day(12) + 2000000, completed: true },
          { id: 'set13', weight: 70, reps: 10, rpe: 7, timestamp: day(12) + 2300000, completed: true },
          { id: 'set14', weight: 75, reps: 8, rpe: 7.5, timestamp: day(12) + 2600000, completed: true },
          { id: 'set15', weight: 75, reps: 8, rpe: 8, timestamp: day(12) + 2900000, completed: true },
        ],
      },
    ],
  },
  {
    id: 's3',
    startTime: day(7),
    endTime: day(7) + 5400000,
    workoutName: 'Week 2 · Day 1 — Squat & Accessories',
    readiness: { sleep: 8, energy: 4, soreness: 2 },
    exercises: [
      {
        exercise: EXERCISES.squat,
        sets: [
          { id: 'set16', weight: 107.5, reps: 8, rpe: 7, timestamp: day(7) + 600000, completed: true },
          { id: 'set17', weight: 107.5, reps: 8, rpe: 7.5, timestamp: day(7) + 1000000, completed: true },
          { id: 'set18', weight: 110, reps: 8, rpe: 8, timestamp: day(7) + 1400000, completed: true },
          { id: 'set19', weight: 110, reps: 7, rpe: 8, timestamp: day(7) + 1800000, completed: true },
          { id: 'set20', weight: 112.5, reps: 6, rpe: 8.5, timestamp: day(7) + 2200000, completed: true },
        ],
      },
    ],
  },
  {
    id: 's4',
    startTime: day(5),
    endTime: day(5) + 4800000,
    workoutName: 'Week 2 · Day 2 — Bench & Upper',
    readiness: { sleep: 7, energy: 3, soreness: 3 },
    exercises: [
      {
        exercise: EXERCISES.bench,
        sets: [
          { id: 'set21', weight: 75, reps: 8, rpe: 7.5, timestamp: day(5) + 600000, completed: true },
          { id: 'set22', weight: 75, reps: 8, rpe: 7.5, timestamp: day(5) + 1000000, completed: true },
          { id: 'set23', weight: 77.5, reps: 7, rpe: 8, timestamp: day(5) + 1400000, completed: true },
          { id: 'set24', weight: 77.5, reps: 6, rpe: 8, timestamp: day(5) + 1800000, completed: true },
          { id: 'set25', weight: 80, reps: 5, rpe: 8.5, timestamp: day(5) + 2200000, completed: true },
        ],
      },
      {
        exercise: EXERCISES.overheadPress,
        sets: [
          { id: 'set26', weight: 45, reps: 8, rpe: 7, timestamp: day(5) + 2800000, completed: true },
          { id: 'set27', weight: 45, reps: 8, rpe: 7.5, timestamp: day(5) + 3100000, completed: true },
          { id: 'set28', weight: 47.5, reps: 6, rpe: 8, timestamp: day(5) + 3400000, completed: true },
          { id: 'set29', weight: 47.5, reps: 6, rpe: 8, timestamp: day(5) + 3700000, completed: true },
        ],
      },
    ],
  },
  {
    id: 's5',
    startTime: day(3),
    endTime: day(3) + 5000000,
    workoutName: 'Week 2 · Day 3 — Deadlift & Back',
    readiness: { sleep: 7.5, energy: 4, soreness: 2 },
    exercises: [
      {
        exercise: EXERCISES.deadlift,
        sets: [
          { id: 'set30', weight: 150, reps: 6, rpe: 7.5, timestamp: day(3) + 600000, completed: true },
          { id: 'set31', weight: 155, reps: 5, rpe: 8, timestamp: day(3) + 1000000, completed: true },
          { id: 'set32', weight: 155, reps: 5, rpe: 8, timestamp: day(3) + 1400000, completed: true },
          { id: 'set33', weight: 160, reps: 4, rpe: 8.5, timestamp: day(3) + 1800000, completed: true },
        ],
      },
      {
        exercise: EXERCISES.barbellRow,
        sets: [
          { id: 'set34', weight: 75, reps: 8, rpe: 7, timestamp: day(3) + 2400000, completed: true },
          { id: 'set35', weight: 77.5, reps: 7, rpe: 7.5, timestamp: day(3) + 2700000, completed: true },
          { id: 'set36', weight: 77.5, reps: 7, rpe: 8, timestamp: day(3) + 3000000, completed: true },
          { id: 'set37', weight: 80, reps: 6, rpe: 8, timestamp: day(3) + 3300000, completed: true },
        ],
      },
    ],
  },
];
