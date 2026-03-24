import { useTrainingStore } from '@/store/useTrainingStore';
import { ExerciseLog, SetLog } from '@/types/training';
import { ChevronRight } from 'lucide-react';

interface TrainTabProps {
  onStartEmpty: () => void;
  onStartToday: (exercises: ExerciseLog[], name: string, dayId: string) => void;
  onViewProgram: () => void;
}

export function TrainTab({ onStartEmpty, onStartToday, onViewProgram }: TrainTabProps) {
  const { program } = useTrainingStore();
  const currentBlock = program.blocks[program.currentBlockIndex];
  const currentDay = currentBlock?.days[program.currentDayIndex];

  const handleStartToday = () => {
    if (!currentBlock || !currentDay) return;
    const exercises: ExerciseLog[] = currentDay.exercises.map((pe) => {
      const sets: SetLog[] = Array.from({ length: pe.prescription.sets }, (_, i) => ({
        id: `preset-${Date.now()}-${i}`,
        weight: 0,
        reps: 0,
        rpe: pe.prescription.rpeTarget || 7,
        timestamp: 0,
        completed: false,
      }));
      return { exercise: pe.exercise, sets };
    });
    const name = `Week ${currentBlock.weekNumber} · ${currentDay.name}`;
    onStartToday(exercises, name, currentDay.id);
  };

  return (
    <div className="flex flex-col gap-4 p-5 pb-24">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Train</h1>

      {currentBlock && currentDay && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onViewProgram}
              className="flex items-center gap-0.5 flex-1 min-w-0 min-h-[44px] text-sm font-medium text-primary"
            >
              <span className="truncate">{program.name}</span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-primary" />
            </button>
            <span className="flex-shrink-0 text-sm text-muted-foreground">
              Week {currentBlock.weekNumber} · {currentDay.name}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-border my-3" />

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-xs text-muted-foreground pb-1">
            <span className="text-left">Exercise</span>
            <span className="text-center w-10">Sets</span>
            <span className="text-center w-10">Reps</span>
            <span className="text-center w-10">RPE</span>
          </div>
          {/* Data rows */}
          <div className="divide-y divide-border">
            {currentDay.exercises.map((pe) => (
              <div
                key={pe.exercise.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 py-2 items-center"
              >
                <span className="text-sm font-medium text-foreground text-left">
                  {pe.exercise.name}
                </span>
                <span className="text-sm text-foreground text-center w-10">
                  {pe.prescription.sets}
                </span>
                <span className="text-sm text-foreground text-center w-10">
                  {pe.prescription.reps}
                </span>
                <span className="text-sm text-foreground text-center w-10">
                  {pe.prescription.rpeTarget ?? '—'}
                </span>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <div className="border-t border-border mt-3 pt-3">
            <button
              type="button"
              onClick={handleStartToday}
              className="bg-primary text-primary-foreground rounded-lg w-full min-h-[52px] font-semibold whitespace-normal text-center active:scale-[0.98] transition-transform"
            >
              Start Week {currentBlock.weekNumber} · {currentDay.name}
            </button>
          </div>
        </div>
      )}

      {/* Start Empty Workout */}
      <button
        type="button"
        onClick={onStartEmpty}
        className="w-full rounded-xl border border-border bg-background min-h-[52px] text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
      >
        Start Empty Workout
      </button>
    </div>
  );
}
