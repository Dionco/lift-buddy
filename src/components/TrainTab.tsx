import { useTrainingStore } from '@/store/useTrainingStore';
import { ExerciseLog, SetLog, Session } from '@/types/training';
import { ChevronRight } from 'lucide-react';

interface TrainTabProps {
  onStartEmpty: () => void;
  onStartToday: (exercises: ExerciseLog[], name: string, dayId: string) => void;
  onViewProgram: () => void;
}

const PHASE_MAP: Record<string, string> = {
  'General Prep': 'Accumulation',
  'Volume': 'Hypertrophy',
  'Intensity': 'Strength',
  'Max Effort': 'Peaking',
};

function getPhaseLabel(focus: string): string {
  return PHASE_MAP[focus] ?? focus;
}

function getRpeBadgeClass(rpe?: number): string {
  if (rpe == null) return '';
  if (rpe >= 9) return 'text-red-700 bg-red-50 ring-1 ring-red-200';
  if (rpe >= 8) return 'text-amber-700 bg-amber-50 ring-1 ring-amber-200';
  return 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200';
}

function getLastTopSet(sessions: Session[], exerciseId: string) {
  for (const session of sessions) {
    const log = session.exercises.find(e => e.exercise.id === exerciseId);
    if (!log) continue;
    const done = log.sets.filter(s => s.completed && s.weight > 0 && s.reps > 0);
    if (!done.length) continue;
    return done.reduce((best, s) => s.weight >= best.weight ? s : best, done[0]);
  }
  return null;
}

export function TrainTab({ onStartEmpty, onStartToday, onViewProgram }: TrainTabProps) {
  const { program, sessions } = useTrainingStore();
  const currentBlock = program.blocks[program.currentBlockIndex];
  const currentWeek = currentBlock?.weeks[program.currentWeekIndex];
  const currentDay = currentWeek?.days[program.currentDayIndex];

  const handleStartToday = () => {
    if (!currentBlock || !currentWeek || !currentDay) return;
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
    const name = `Week ${currentWeek.weekNumber} · ${currentDay.name}`;
    onStartToday(exercises, name, currentDay.id);
  };

  const phaseLabel = currentBlock ? getPhaseLabel(currentBlock.focus) : '';
  const totalSets = currentDay?.exercises.reduce((sum, pe) => sum + pe.prescription.sets, 0) ?? 0;
  // Strip "Day N — " prefix for a cleaner title
  const dayTitle = currentDay?.name.replace(/^Day\s*\d+\s*[—\-]\s*/, '') ?? '';

  const mainLifts = currentDay?.exercises.filter(pe => pe.exercise.isMainLift) ?? [];
  const accessories = currentDay?.exercises.filter(pe => !pe.exercise.isMainLift) ?? [];

  return (
    <div className="flex flex-col gap-5 p-5 pb-24">

      {/* Page header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Train</h1>
        {phaseLabel && (
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            {phaseLabel} Phase
          </span>
        )}
      </div>

      {/* Block progression arc */}
      {currentBlock && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            {program.blocks.map((block, i) => (
              <div
                key={block.id}
                className={`h-[3px] flex-1 rounded-sm transition-colors ${
                  i < program.currentBlockIndex
                    ? 'bg-foreground/35'
                    : i === program.currentBlockIndex
                    ? 'bg-foreground'
                    : 'bg-foreground/10'
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            Week {currentWeek?.weekNumber ?? 1} of {currentBlock.weeks.length} · {phaseLabel} Phase
          </p>
        </div>
      )}

      {/* Session card */}
      {currentBlock && currentWeek && currentDay && (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">

          {/* Card header: session identity */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Day {program.currentDayIndex + 1} of {currentWeek.days.length}
                </p>
                <h2 className="text-[1.1rem] font-bold text-foreground leading-snug mt-0.5 truncate">
                  {dayTitle}
                </h2>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {currentDay.exercises.length} exercises · {totalSets} sets
                </p>
              </div>
              <button
                type="button"
                onClick={onViewProgram}
                className="flex items-center gap-0.5 min-h-[44px] text-[13px] font-medium text-primary flex-shrink-0 -mr-1"
              >
                View Program
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Day progress within block */}
            <div className="flex gap-1 mt-3">
              {currentWeek.days.map((_, i) => (
                <div
                  key={i}
                  className={`h-[2px] flex-1 rounded-full ${
                    i < program.currentDayIndex
                      ? 'bg-foreground/35'
                      : i === program.currentDayIndex
                      ? 'bg-foreground'
                      : 'bg-foreground/10'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Main Lifts section */}
          {mainLifts.length > 0 && (
            <div className="border-t border-border/60">
              <div className="px-4 pt-2.5 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  Main Lifts
                </span>
              </div>
              {mainLifts.map((pe) => {
                const lastSet = getLastTopSet(sessions, pe.exercise.id);
                const rpeBadgeClass = getRpeBadgeClass(pe.prescription.rpeTarget);
                return (
                  <div key={pe.exercise.id} className="flex items-center gap-3 px-4 py-2.5">
                    {/* Left accent bar */}
                    <div className="w-[3px] self-stretch rounded-full bg-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-foreground block truncate">
                        {pe.exercise.name}
                      </span>
                      {lastSet ? (
                        <span className="text-[11px] text-muted-foreground">
                          Last: {lastSet.weight}kg × {lastSet.reps}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40">No history</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {pe.prescription.sets}×{pe.prescription.reps}
                      </span>
                      {pe.prescription.rpeTarget != null && (
                        <span className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 ${rpeBadgeClass}`}>
                          @{pe.prescription.rpeTarget}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Accessories section */}
          {accessories.length > 0 && (
            <div className="border-t border-border/60">
              <div className="px-4 pt-2.5 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  Accessories
                </span>
              </div>
              {accessories.map((pe) => {
                const lastSet = getLastTopSet(sessions, pe.exercise.id);
                const rpeBadgeClass = getRpeBadgeClass(pe.prescription.rpeTarget);
                return (
                  <div key={pe.exercise.id} className="flex items-center gap-3 px-4 py-2">
                    {/* Spacer to align with main lifts */}
                    <div className="w-[3px] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground/80 block truncate">
                        {pe.exercise.name}
                      </span>
                      {lastSet && (
                        <span className="text-[11px] text-muted-foreground">
                          Last: {lastSet.weight}kg × {lastSet.reps}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium tabular-nums text-foreground/70">
                        {pe.prescription.sets}×{pe.prescription.reps}
                      </span>
                      {pe.prescription.rpeTarget != null && (
                        <span className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 ${rpeBadgeClass}`}>
                          @{pe.prescription.rpeTarget}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Start CTA */}
          <div className="p-4 pt-3 border-t border-border/60 mt-1">
            <button
              type="button"
              onClick={handleStartToday}
              className="w-full bg-foreground text-background rounded-xl min-h-[54px] font-bold text-[15px] tracking-tight active:scale-[0.98] transition-transform"
            >
              Start {dayTitle}
            </button>
          </div>
        </div>
      )}

      {/* Start Empty Workout */}
      <button
        type="button"
        onClick={onStartEmpty}
        className="w-full rounded-xl border border-border bg-background min-h-[50px] text-sm font-semibold text-muted-foreground active:scale-[0.98] transition-transform"
      >
        Start Empty Workout
      </button>
    </div>
  );
}
