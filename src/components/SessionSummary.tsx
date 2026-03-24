import { useState, useMemo } from 'react';
import { Session, MAIN_LIFTS, getTopSetE1RM } from '@/types/training';
import { Textarea } from '@/components/ui/textarea';
import { Clock, BarChart3, Activity, Trophy } from 'lucide-react';

interface SessionSummaryProps {
  session: Session;
  onSave: (note?: string) => void;
}

export function SessionSummary({ session, onSave }: SessionSummaryProps) {
  const [note, setNote] = useState(session.note || '');

  const stats = useMemo(() => {
    const totalSets = session.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0
    );
    const duration = session.endTime
      ? Math.round((session.endTime - session.startTime) / 60000)
      : 0;
    const allRpes = session.exercises.flatMap((ex) =>
      ex.sets.filter((s) => s.completed).map((s) => s.rpe)
    );
    const avgRpe = allRpes.length > 0
      ? (allRpes.reduce((a, b) => a + b, 0) / allRpes.length).toFixed(1)
      : '—';

    const mainLiftE1RMs: { name: string; e1rm: number }[] = [];
    for (const ex of session.exercises) {
      if (MAIN_LIFTS.includes(ex.exercise.name as any)) {
        const e1rm = getTopSetE1RM(ex.sets);
        if (e1rm > 0) mainLiftE1RMs.push({ name: ex.exercise.name, e1rm });
      }
    }

    return { totalSets, duration, avgRpe, mainLiftE1RMs };
  }, [session]);

  return (
    <div className="flex min-h-screen flex-col p-6 pb-24">
      <h2 className="text-2xl font-bold text-foreground mb-1">Session Complete 🎉</h2>
      <p className="text-sm text-muted-foreground mb-6">{session.workoutName || 'Custom Workout'}</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
          <BarChart3 className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold">{stats.totalSets}</span>
          <span className="text-xs text-muted-foreground">Sets</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
          <Clock className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold">{stats.duration}</span>
          <span className="text-xs text-muted-foreground">Min</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
          <Activity className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold">{stats.avgRpe}</span>
          <span className="text-xs text-muted-foreground">Avg RPE</span>
        </div>
      </div>

      {stats.mainLiftE1RMs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Top Set e1RM
          </h3>
          <div className="flex flex-col gap-2">
            {stats.mainLiftE1RMs.map(({ name, e1rm }) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
                <span className="font-semibold text-foreground">{name}</span>
                <span className="text-xl font-bold text-primary">{Math.round(e1rm)} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <label className="text-sm font-semibold text-muted-foreground mb-2 block">Session Notes</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="How did it feel? Anything to note..."
          className="min-h-[100px] text-base"
        />
      </div>

      <button
        onClick={() => onSave(note || undefined)}
        className="min-h-[52px] w-full rounded-xl bg-primary font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
      >
        Save & Close
      </button>
    </div>
  );
}
