import { useTrainingStore } from '@/store/useTrainingStore';
import { ExerciseLog, SetLog } from '@/types/training';
import { Play, Zap, BookOpen, ChevronRight } from 'lucide-react';

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
    if (!currentDay) return;
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

      <button
        onClick={onStartEmpty}
        className="flex min-h-[72px] items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Play className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-base font-semibold text-foreground">Start Empty Workout</p>
          <p className="text-sm text-muted-foreground">Begin with a blank session</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      {currentDay && (
        <button
          onClick={handleStartToday}
          className="flex min-h-[72px] items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-base font-semibold text-foreground">Today's Session</p>
            <p className="text-sm text-muted-foreground">
              Week {currentBlock.weekNumber} · {currentDay.name}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      )}

      <button
        onClick={onViewProgram}
        className="flex min-h-[72px] items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
          <BookOpen className="h-6 w-6 text-secondary-foreground" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-base font-semibold text-foreground">View Program</p>
          <p className="text-sm text-muted-foreground">{program.name}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
}
