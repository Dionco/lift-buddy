import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session, Program, ExerciseLog, SetLog, ReadinessCheckIn } from '@/types/training';
import { sampleProgram } from '@/data/sampleProgram';
import { sampleSessions } from '@/data/sampleSessions';

interface TrainingState {
  sessions: Session[];
  program: Program;
  activeSession: Session | null;
  restTimerDuration: number; // seconds

  startSession: (workoutName?: string, programDayId?: string, exercises?: ExerciseLog[]) => void;
  setReadiness: (readiness: ReadinessCheckIn) => void;
  addExercise: (exerciseLog: ExerciseLog) => void;
  logSet: (exerciseIndex: number, set: SetLog) => void;
  updateSet: (exerciseIndex: number, setIndex: number, set: Partial<SetLog>) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  addSetToExercise: (exerciseIndex: number) => void;
  finishSession: (note?: string) => void;
  cancelSession: () => void;
  setRestTimerDuration: (seconds: number) => void;
  updateProgramProgress: (blockIndex: number, dayIndex: number) => void;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      sessions: sampleSessions,
      program: sampleProgram,
      activeSession: null,
      restTimerDuration: 120,

      startSession: (workoutName, programDayId, exercises) => {
        const session: Session = {
          id: `session-${Date.now()}`,
          startTime: Date.now(),
          exercises: exercises || [],
          workoutName,
          programDayId,
        };
        set({ activeSession: session });
      },

      setReadiness: (readiness) => {
        const { activeSession } = get();
        if (activeSession) {
          set({ activeSession: { ...activeSession, readiness } });
        }
      },

      addExercise: (exerciseLog) => {
        const { activeSession } = get();
        if (activeSession) {
          set({
            activeSession: {
              ...activeSession,
              exercises: [...activeSession.exercises, exerciseLog],
            },
          });
        }
      },

      logSet: (exerciseIndex, setData) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = [...activeSession.exercises];
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          sets: [...exercises[exerciseIndex].sets, setData],
        };
        set({ activeSession: { ...activeSession, exercises } });
      },

      updateSet: (exerciseIndex, setIndex, updates) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = [...activeSession.exercises];
        const sets = [...exercises[exerciseIndex].sets];
        sets[setIndex] = { ...sets[setIndex], ...updates };
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], sets };
        set({ activeSession: { ...activeSession, exercises } });
      },

      removeSet: (exerciseIndex, setIndex) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = [...activeSession.exercises];
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          sets: exercises[exerciseIndex].sets.filter((_, i) => i !== setIndex),
        };
        set({ activeSession: { ...activeSession, exercises } });
      },

      addSetToExercise: (exerciseIndex) => {
        const { activeSession } = get();
        if (!activeSession) return;
        const exercises = [...activeSession.exercises];
        const lastSet = exercises[exerciseIndex].sets[exercises[exerciseIndex].sets.length - 1];
        const newSet: SetLog = {
          id: `set-${Date.now()}`,
          weight: lastSet?.weight || 0,
          reps: lastSet?.reps || 0,
          rpe: lastSet?.rpe || 7,
          timestamp: Date.now(),
          completed: false,
        };
        exercises[exerciseIndex] = {
          ...exercises[exerciseIndex],
          sets: [...exercises[exerciseIndex].sets, newSet],
        };
        set({ activeSession: { ...activeSession, exercises } });
      },

      finishSession: (note) => {
        const { activeSession, sessions } = get();
        if (!activeSession) return;
        const finished: Session = {
          ...activeSession,
          endTime: Date.now(),
          note,
        };
        set({
          sessions: [finished, ...sessions],
          activeSession: null,
        });
      },

      cancelSession: () => set({ activeSession: null }),

      setRestTimerDuration: (seconds) => set({ restTimerDuration: seconds }),

      updateProgramProgress: (blockIndex, dayIndex) => {
        const { program } = get();
        set({
          program: { ...program, currentBlockIndex: blockIndex, currentDayIndex: dayIndex },
        });
      },
    }),
    {
      name: 'training-store',
    }
  )
);
