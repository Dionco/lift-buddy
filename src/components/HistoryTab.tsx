import { useState, useMemo } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { Session, MAIN_LIFTS, getTopSetE1RM } from '@/types/training';
import { ChevronDown, ChevronUp, Clock, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HistoryTab() {
  const { sessions } = useTrainingStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() =>
    [...sessions].sort((a, b) => b.startTime - a.startTime),
  [sessions]);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    });

  const formatDuration = (s: Session) => {
    if (!s.endTime) return '—';
    return `${Math.round((s.endTime - s.startTime) / 60000)} min`;
  };

  const getAvgRpe = (s: Session) => {
    const rpes = s.exercises.flatMap((ex) =>
      ex.sets.filter((set) => set.completed).map((set) => set.rpe)
    );
    return rpes.length > 0 ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : '—';
  };

  const getTotalSets = (s: Session) =>
    s.exercises.reduce((sum, ex) => sum + ex.sets.filter((set) => set.completed).length, 0);

  return (
    <div className="flex flex-col gap-3 p-5 pb-24">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">History</h1>

      {sorted.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No sessions yet. Start training!</p>
      )}

      {sorted.map((session) => {
        const isExpanded = expandedId === session.id;
        return (
          <div key={session.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
              className="flex w-full items-center gap-3 p-4 text-left min-h-[64px]"
            >
              <div className="flex-1">
                <p className="font-semibold text-foreground">{session.workoutName || 'Custom Workout'}</p>
                <p className="text-sm text-muted-foreground">{formatDate(session.startTime)}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{getTotalSets(session)}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(session)}</span>
                <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{getAvgRpe(session)}</span>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 pb-4 pt-3">
                {session.readiness && (
                  <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                    <span>Sleep: {session.readiness.sleep}h</span>
                    <span>Energy: {session.readiness.energy}/5</span>
                    <span>Soreness: {session.readiness.soreness}/5</span>
                  </div>
                )}
                {session.exercises.map((ex, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground text-sm">{ex.exercise.name}</span>
                      <span className="text-xs rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                        {ex.exercise.muscleGroup}
                      </span>
                      {MAIN_LIFTS.includes(ex.exercise.name as any) && getTopSetE1RM(ex.sets) > 0 && (
                        <span className="ml-auto text-xs font-semibold text-primary">
                          e1RM: {Math.round(getTopSetE1RM(ex.sets))}kg
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 ml-2">
                      {ex.sets.filter(s => s.completed).map((set, si) => (
                        <span key={si} className="text-xs text-muted-foreground tabular-nums">
                          Set {si + 1}: {set.weight}kg × {set.reps} @RPE {set.rpe}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {session.note && (
                  <p className="mt-3 text-sm text-muted-foreground italic border-t border-border pt-3">{session.note}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
