import { useMemo, useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { MAIN_LIFTS, getTopSetE1RM } from '@/types/training';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const VOLUME_TARGETS: Record<string, [number, number]> = {
  Quads: [8, 15],
  Glutes: [8, 15],
  Chest: [10, 20],
  Triceps: [10, 20],
  'Posterior Chain': [6, 12],
  Hamstrings: [6, 12],
};

export function ProgressTab() {
  const { sessions } = useTrainingStore();
  const [weekOffset, setWeekOffset] = useState(0);

  // e1RM trends
  const e1rmData = useMemo(() => {
    const data: Record<string, { date: string; e1rm: number; timestamp: number }[]> = {
      Squat: [], 'Bench Press': [], Deadlift: [],
    };
    const sorted = [...sessions].sort((a, b) => a.startTime - b.startTime);
    for (const session of sorted) {
      for (const ex of session.exercises) {
        if (MAIN_LIFTS.includes(ex.exercise.name as any)) {
          const e1rm = getTopSetE1RM(ex.sets);
          if (e1rm > 0) {
            data[ex.exercise.name].push({
              date: new Date(session.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
              e1rm: Math.round(e1rm),
              timestamp: session.startTime,
            });
          }
        }
      }
    }
    return data;
  }, [sessions]);

  // Fatigue flags
  const fatigueFlags = useMemo(() => {
    const flags: Record<string, boolean> = {};
    for (const lift of MAIN_LIFTS) {
      const pts = e1rmData[lift];
      if (pts.length >= 3) {
        const last3 = pts.slice(-3);
        flags[lift] = last3[1].e1rm < last3[0].e1rm && last3[2].e1rm < last3[1].e1rm;
      } else {
        flags[lift] = false;
      }
    }
    return flags;
  }, [e1rmData]);

  // Weekly volume
  const weekData = useMemo(() => {
    const now = new Date();
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
    currentMonday.setHours(0, 0, 0, 0);
    const sunday = new Date(currentMonday);
    sunday.setDate(currentMonday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekSessions = sessions.filter(
      (s) => s.startTime >= currentMonday.getTime() && s.startTime <= sunday.getTime()
    );

    const muscleVolume: Record<string, number> = {};
    let totalKg = 0;
    const dayRpes: Record<string, number[]> = {};

    for (const session of weekSessions) {
      const dayKey = new Date(session.startTime).toLocaleDateString('en-GB', { weekday: 'short' });
      for (const ex of session.exercises) {
        const completed = ex.sets.filter((s) => s.completed);
        const group = ex.exercise.muscleGroup;
        muscleVolume[group] = (muscleVolume[group] || 0) + completed.length;
        for (const set of completed) {
          totalKg += set.weight * set.reps;
          if (!dayRpes[dayKey]) dayRpes[dayKey] = [];
          dayRpes[dayKey].push(set.rpe);
        }
      }
    }

    const rpeByDay = Object.entries(dayRpes).map(([day, rpes]) => ({
      day,
      avgRpe: +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1),
    }));

    return {
      start: currentMonday,
      end: sunday,
      muscleVolume,
      totalKg: Math.round(totalKg),
      rpeByDay,
    };
  }, [sessions, weekOffset]);

  const formatWeek = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="flex flex-col gap-6 p-5 pb-24">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Progress</h1>

      {/* e1RM Charts */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">e1RM Trends</h3>
        {MAIN_LIFTS.map((lift) => {
          const pts = e1rmData[lift];
          if (pts.length === 0) return null;
          return (
            <div key={lift} className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-foreground">{lift}</span>
                {fatigueFlags[lift] && (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" /> Fatigue
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={pts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={['auto', 'auto']} />
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    stroke={fatigueFlags[lift] ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                    strokeWidth={2}
                    dot={{ r: 4, fill: fatigueFlags[lift] ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      {/* Weekly Volume */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Weekly Volume</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(weekOffset - 1)} className="h-9 w-9 flex items-center justify-center rounded-lg bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-foreground min-w-[120px] text-center">
              {formatWeek(weekData.start)} — {formatWeek(weekData.end)}
            </span>
            <button onClick={() => setWeekOffset(Math.min(0, weekOffset + 1))} className="h-9 w-9 flex items-center justify-center rounded-lg bg-secondary" disabled={weekOffset >= 0}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3">
            {Object.entries(weekData.muscleVolume).map(([group, sets]) => {
              const target = VOLUME_TARGETS[group];
              let color: string;
              if (!target) color = 'bg-primary';
              else if (sets < target[0]) color = 'bg-muted-foreground/30';
              else if (sets > target[1]) color = 'bg-warning';
              else color = 'bg-success';

              return (
                <div key={group}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">{group}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {sets} sets
                      {target && <span className="ml-1 text-xs">({target[0]}-{target[1]})</span>}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', color)}
                      style={{ width: `${Math.min(100, (sets / (target?.[1] || 20)) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(weekData.muscleVolume).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data this week</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Volume</span>
            <span className="text-lg font-bold text-foreground">{weekData.totalKg.toLocaleString()} kg</span>
          </div>
        </div>

        {weekData.rpeByDay.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Avg RPE per Session</h4>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={weekData.rpeByDay}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[6, 10]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Bar dataKey="avgRpe" radius={[4, 4, 0, 0]}>
                  {weekData.rpeByDay.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--primary))" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
