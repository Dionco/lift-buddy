import { useState, useMemo } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { Session, getTopSetE1RM } from '@/types/training';
import { formatMuscles } from '@/lib/muscleLabels';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock, Activity, BarChart3, Dumbbell, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DayContentProps } from 'react-day-picker';
function dateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function calendarDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
export function HistoryTab() {
  const { sessions } = useTrainingStore();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const sorted = useMemo(() =>
    [...sessions].sort((a, b) => b.startTime - a.startTime),
  [sessions]);
  // Set of date keys that have workouts (for calendar dot indicators)
  const workoutDateKeys = useMemo(() => {
    const keys = new Set<string>();
    sessions.forEach(s => keys.add(dateKey(s.startTime)));
    return keys;
  }, [sessions]);
  // Days with workouts as Date objects for calendar modifiers
  const workoutDays = useMemo(() => {
    const seen = new Set<string>();
    return sessions.reduce<Date[]>((acc, s) => {
      const key = dateKey(s.startTime);
      if (!seen.has(key)) {
        seen.add(key);
        const d = new Date(s.startTime);
        acc.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      }
      return acc;
    }, []);
  }, [sessions]);
  const displayed = useMemo(() => {
    if (!selectedDate) return sorted;
    const key = calendarDateKey(selectedDate);
    return sorted.filter(s => dateKey(s.startTime) === key);
  }, [sorted, selectedDate]);
  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const handleDaySelect = (date: Date | undefined) => {
    if (date && selectedDate && calendarDateKey(date) === calendarDateKey(selectedDate)) {
      setSelectedDate(undefined);
    } else {
      setSelectedDate(date);
    }
  };
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const formatDuration = (s: Session) => {
    if (!s.endTime) return '—';
    const mins = Math.round((s.endTime - s.startTime) / 60000);
    return `${mins} min`;
  };
  const getAvgRpe = (s: Session) => {
    const rpes = s.exercises.flatMap(ex =>
      ex.sets.filter(set => set.completed).map(set => set.rpe)
    );
    return rpes.length > 0 ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : null;
  };
  const getTotalSets = (s: Session) =>
    s.exercises.reduce((sum, ex) => sum + ex.sets.filter(set => set.completed).length, 0);
  const getTotalVolume = (s: Session) =>
    s.exercises.reduce((sum, ex) =>
      sum + ex.sets.filter(set => set.completed).reduce((ss, set) => ss + set.weight * set.reps, 0),
    0);
  // Custom day content to render workout dots
  const DayContent = ({ date }: DayContentProps) => {
    const hasWorkout = workoutDateKeys.has(calendarDateKey(date));
    return (
      <div className="relative flex flex-col items-center justify-center w-full h-full">
        <span>{date.getDate()}</span>
        {hasWorkout && (
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary opacity-80" />
        )}
      </div>
    );
  };
  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">History</h1>
      {/* Calendar */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDaySelect}
          modifiers={{ workout: workoutDays }}
          components={{
            DayContent,
            IconLeft: () => <ChevronLeft className="h-4 w-4" />,
            IconRight: () => <ChevronRight className="h-4 w-4" />,
          }}
          className="w-full p-0"
          classNames={{
            months: 'w-full',
            month: 'w-full',
            caption: 'flex justify-center pt-4 pb-2 relative items-center px-4',
            caption_label: 'text-base font-semibold',
            nav: 'space-x-1 flex items-center',
            nav_button: cn(
              'h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-md border border-border flex items-center justify-center',
            ),
            nav_button_previous: 'absolute left-3',
            nav_button_next: 'absolute right-3',
            table: 'w-full border-collapse px-3 pb-3',
            head_row: 'flex w-full',
            head_cell: 'text-muted-foreground rounded-md flex-1 font-normal text-xs text-center py-1',
            row: 'flex w-full mt-1',
            cell: 'flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
            day: cn(
              'mx-auto h-9 w-9 p-0 font-normal rounded-full flex items-center justify-center',
              'hover:bg-accent hover:text-accent-foreground transition-colors',
              'aria-selected:opacity-100',
            ),
            day_selected:
              'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
            day_today: 'bg-accent text-accent-foreground font-semibold',
            day_outside: 'text-muted-foreground opacity-30',
            day_disabled: 'text-muted-foreground opacity-30',
            day_hidden: 'invisible',
          }}
        />
        <div className="px-4 pb-3 text-center text-xs text-muted-foreground">
          Tap a highlighted day to filter · tap again to clear
        </div>
      </div>
      {/* Active filter chip */}
      {selectedDate && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-sm font-medium text-primary">
            {selectedLabel}
            <button
              onClick={() => setSelectedDate(undefined)}
              className="ml-1 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-sm text-muted-foreground">
            {displayed.length} {displayed.length === 1 ? 'workout' : 'workouts'}
          </span>
        </div>
      )}
      {/* Session list */}
      {displayed.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          {selectedDate ? 'No workouts on this day.' : 'No sessions yet. Start training!'}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {displayed.map((session) => {
          const isExpanded = expandedIds.has(session.id);
          const totalSets = getTotalSets(session);
          const totalVolume = getTotalVolume(session);
          const avgRpe = getAvgRpe(session);
          return (
            <div key={session.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Card header */}
              <button
                onClick={() => toggleExpanded(session.id)}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground leading-snug">
                    {session.workoutName || 'Custom Workout'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatDate(session.startTime)}
                    <span className="mx-1.5 opacity-40">·</span>
                    {formatTime(session.startTime)}
                  </p>
                  {/* Stats row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatDuration(session)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BarChart3 className="h-3 w-3 shrink-0" />
                      {totalSets} {totalSets === 1 ? 'set' : 'sets'}
                    </span>
                    {totalVolume > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Dumbbell className="h-3 w-3 shrink-0" />
                        {totalVolume >= 1000
                          ? `${(totalVolume / 1000).toFixed(1)}t`
                          : `${totalVolume}kg`} volume
                      </span>
                    )}
                    {avgRpe && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Activity className="h-3 w-3 shrink-0" />
                        RPE {avgRpe} avg
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-1 shrink-0">
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                  {/* Readiness */}
                  {session.readiness && (
                    <div className="flex gap-3 flex-wrap">
                      <ReadinessBadge label="Sleep" value={`${session.readiness.sleep}h`} />
                      <ReadinessBadge label="Energy" value={`${session.readiness.energy}/5`} />
                      <ReadinessBadge label="Soreness" value={`${session.readiness.soreness}/5`} />
                    </div>
                  )}
                  {/* Exercises */}
                  {session.exercises.map((ex, i) => {
                    const completedSets = ex.sets.filter(s => s.completed);
                    if (completedSets.length === 0) return null;
                    const e1rm = getTopSetE1RM(ex.sets);
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-medium text-sm text-foreground">{ex.exercise.name}</span>
                          <span className="text-xs rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground shrink-0">
                            {formatMuscles(ex.exercise)}
                          </span>
                          {e1rm > 0 && (
                            <span className="ml-auto text-xs font-semibold text-primary shrink-0">
                              e1RM {Math.round(e1rm)}kg
                            </span>
                          )}
                        </div>
                        <div className="rounded-lg bg-muted/50 divide-y divide-border/50">
                          {completedSets.map((set, si) => (
                            <div key={si} className="flex items-center px-3 py-2 text-xs tabular-nums">
                              <span className="text-muted-foreground w-10">Set {si + 1}</span>
                              <span className="font-medium text-foreground">{set.weight}kg</span>
                              <span className="text-muted-foreground mx-1">×</span>
                              <span className="font-medium text-foreground">{set.reps}</span>
                              <span className="text-muted-foreground ml-1">reps</span>
                              <span className="ml-auto text-muted-foreground">@RPE {set.rpe}</span>
                              <span className="ml-3 text-muted-foreground">{set.weight * set.reps}kg</span>
                            </div>
                          ))}
                          <div className="flex items-center px-3 py-1.5 text-xs text-muted-foreground border-t border-border/50">
                            <span className="w-10" />
                            <span>{completedSets.length} sets</span>
                            <span className="ml-auto font-medium text-foreground">
                              {completedSets.reduce((s, set) => s + set.weight * set.reps, 0)}kg total
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Session note */}
                  {session.note && (
                    <p className="text-sm text-muted-foreground italic border-t border-border pt-3">
                      {session.note}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ReadinessBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}