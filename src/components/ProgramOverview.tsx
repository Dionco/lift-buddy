import { useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgramOverviewProps {
  onBack: () => void;
}

export function ProgramOverview({ onBack }: ProgramOverviewProps) {
  const { program } = useTrainingStore();
  const [expandedBlock, setExpandedBlock] = useState<string | null>(
    program.blocks[program.currentBlockIndex]?.id || null
  );

  return (
    <div className="flex flex-col pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-lg">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h2 className="text-lg font-bold">{program.name}</h2>
      </div>

      <div className="flex flex-col gap-3 p-5">
        {program.blocks.map((block, blockIdx) => {
          const isCurrent = blockIdx === program.currentBlockIndex;
          const isExpanded = expandedBlock === block.id;
          return (
            <div key={block.id}>
              <button
                onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                className={cn(
                  'flex min-h-[64px] w-full items-center gap-4 rounded-xl border p-4 text-left transition-all active:scale-[0.98]',
                  isCurrent
                    ? 'border-primary/30 bg-primary/5 shadow-sm'
                    : 'border-border bg-card'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
                    isCurrent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  B{blockIdx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{block.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {block.focus} · {block.weeks.length} {block.weeks.length === 1 ? 'week' : 'weeks'}
                  </p>
                </div>
                {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="mt-2 ml-7 flex flex-col gap-3 border-l-2 border-border pl-5">
                  {block.weeks.map((week, weekIdx) => {
                    const isCurrentWeek = isCurrent && weekIdx === program.currentWeekIndex;
                    return (
                      <div key={week.id} className="flex flex-col gap-2">
                        <p className={cn(
                          'text-xs font-bold uppercase tracking-widest',
                          isCurrentWeek ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          Week {week.weekNumber}
                        </p>
                        {week.days.map((day, dayIdx) => {
                          const isDayActive = isCurrentWeek && dayIdx === program.currentDayIndex;
                          return (
                            <div
                              key={day.id}
                              className={cn(
                                'rounded-lg border p-4',
                                isDayActive ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'
                              )}
                            >
                              <p className={cn('font-medium mb-2', isDayActive && 'text-primary')}>
                                {day.name}
                                {isDayActive && <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Next</span>}
                              </p>
                              <div className="flex flex-col gap-1">
                                {day.exercises.map((pe) => (
                                  <div key={pe.exercise.id} className="flex items-center justify-between text-sm">
                                    <span className="text-foreground">{pe.exercise.name}</span>
                                    <span className="text-muted-foreground">
                                      {pe.prescription.sets}×{pe.prescription.reps}
                                      {pe.prescription.rpeTarget && ` @${pe.prescription.rpeTarget}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
