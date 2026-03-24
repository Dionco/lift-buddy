import { useState, useRef } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { MAIN_LIFTS, getTopSetE1RM } from '@/types/training';
import { RestTimer } from './RestTimer';
import { Plus, Minus, Check, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveWorkoutProps {
  onFinish: () => void;
  onCancel: () => void;
}

export function ActiveWorkout({ onFinish, onCancel }: ActiveWorkoutProps) {
  const { activeSession, updateSet, removeSet, addSetToExercise, restTimerDuration } = useTrainingStore();
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [activeExercise, setActiveExercise] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!activeSession) return null;

  const exercises = activeSession.exercises;
  const currentEx = exercises[activeExercise];
  if (!currentEx) return null;

  const isMainLift = MAIN_LIFTS.includes(currentEx.exercise.name as any);
  const allCompleted = currentEx.sets.every((s) => s.completed);
  const e1rm = isMainLift && allCompleted && currentEx.sets.length > 0
    ? getTopSetE1RM(currentEx.sets)
    : null;

  const handleCompleteSet = (setIdx: number) => {
    updateSet(activeExercise, setIdx, { completed: true, timestamp: Date.now() });
    setShowRestTimer(true);
  };

  const handleWeightChange = (setIdx: number, delta: number) => {
    const current = currentEx.sets[setIdx].weight;
    updateSet(activeExercise, setIdx, { weight: Math.max(0, current + delta) });
  };

  const handleRepsChange = (setIdx: number, delta: number) => {
    const current = currentEx.sets[setIdx].reps;
    updateSet(activeExercise, setIdx, { reps: Math.max(0, current + delta) });
  };

  const handleRpeChange = (setIdx: number, delta: number) => {
    const current = currentEx.sets[setIdx].rpe;
    const next = Math.min(10, Math.max(6, current + delta));
    updateSet(activeExercise, setIdx, { rpe: next });
  };

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={onCancel} className="flex h-11 w-11 items-center justify-center rounded-lg">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">
            {activeExercise + 1}/{exercises.length}
          </span>
          <button
            onClick={onFinish}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground min-h-[44px]"
          >
            Finish
          </button>
        </div>
      </div>

      {/* Exercise tabs */}
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        {exercises.map((ex, i) => (
          <button
            key={i}
            onClick={() => setActiveExercise(i)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm font-medium min-h-[40px] transition-colors',
              i === activeExercise
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            )}
          >
            {ex.exercise.name}
          </button>
        ))}
      </div>

      <div className="px-5 pt-2">
        <h2 className="text-xl font-bold text-foreground">{currentEx.exercise.name}</h2>
        <span className="inline-block mt-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {currentEx.exercise.muscleGroup}
        </span>

        {e1rm && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">Top Set e1RM</p>
            <p className="text-3xl font-extrabold text-primary">{Math.round(e1rm)} kg</p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span className="w-8">Set</span>
            <span className="text-center">Weight</span>
            <span className="text-center">Reps</span>
            <span className="text-center">RPE</span>
            <span className="w-11"></span>
          </div>

          {currentEx.sets.map((set, setIdx) => (
            <div
              key={set.id}
              className={cn(
                'grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-2 rounded-xl border p-3',
                set.completed ? 'border-success/30 bg-success/5' : 'border-border bg-card'
              )}
            >
              <span className="w-8 text-center text-sm font-bold text-muted-foreground">{setIdx + 1}</span>

              {/* Weight */}
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => handleWeightChange(setIdx, 2.5)} className="h-8 w-full rounded bg-secondary text-foreground font-medium" disabled={set.completed}>
                  <Plus className="h-4 w-4 mx-auto" />
                </button>
                <span className="text-lg font-bold tabular-nums">{set.weight}</span>
                <button onClick={() => handleWeightChange(setIdx, -2.5)} className="h-8 w-full rounded bg-secondary text-foreground font-medium" disabled={set.completed}>
                  <Minus className="h-4 w-4 mx-auto" />
                </button>
              </div>

              {/* Reps */}
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => handleRepsChange(setIdx, 1)} className="h-8 w-full rounded bg-secondary text-foreground font-medium" disabled={set.completed}>
                  <Plus className="h-4 w-4 mx-auto" />
                </button>
                <span className="text-lg font-bold tabular-nums">{set.reps}</span>
                <button onClick={() => handleRepsChange(setIdx, -1)} className="h-8 w-full rounded bg-secondary text-foreground font-medium" disabled={set.completed}>
                  <Minus className="h-4 w-4 mx-auto" />
                </button>
              </div>

              {/* RPE */}
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => handleRpeChange(setIdx, 0.5)} className="h-8 w-full rounded bg-secondary text-foreground font-medium" disabled={set.completed}>
                  <Plus className="h-4 w-4 mx-auto" />
                </button>
                <span className="text-lg font-bold tabular-nums">{set.rpe}</span>
                <button onClick={() => handleRpeChange(setIdx, -0.5)} className="h-8 w-full rounded bg-secondary text-foreground font-medium" disabled={set.completed}>
                  <Minus className="h-4 w-4 mx-auto" />
                </button>
              </div>

              {/* Complete button */}
              <button
                onClick={() => set.completed ? undefined : handleCompleteSet(setIdx)}
                disabled={set.completed || (set.weight === 0 && set.reps === 0)}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
                  set.completed
                    ? 'bg-success text-success-foreground'
                    : 'bg-primary text-primary-foreground disabled:opacity-30'
                )}
              >
                <Check className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => addSetToExercise(activeExercise)}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground active:bg-secondary"
          >
            <Plus className="h-4 w-4" /> Add Set
          </button>
          {currentEx.sets.length > 1 && (
            <button
              onClick={() => removeSet(activeExercise, currentEx.sets.length - 1)}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-dashed border-destructive/30 px-4 text-sm font-medium text-destructive active:bg-destructive/10"
            >
              <Minus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showRestTimer && (
        <RestTimer duration={restTimerDuration} onDismiss={() => setShowRestTimer(false)} />
      )}
    </div>
  );
}
