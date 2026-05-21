import { useMemo, useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { MAIN_LIFTS, getTopSetE1RM, MuscleGroup, MUSCLE_REGION, MUSCLE_REGION_ORDER, MuscleRegion } from '@/types/training';
import { fatigueSignal } from '@/lib/progressSignal';
import {
  computeWeeklyVolume,
  computePlannedWeeklyVolume,
  classifyVolume,
  VOLUME_LANDMARKS,
  type VolumeStatus,
} from '@/lib/volume';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const VOLUME_BAR_COLOR: Record<VolumeStatus, string> = {
  'below-mev': 'bg-muted-foreground/30',
  'in-mav': 'bg-success',
  'near-mrv': 'bg-success',
  'over-mrv': 'bg-warning',
  unknown: 'bg-primary',
};

export function ProgressTab() {
  const { sessions, program } = useTrainingStore();
  const [weekOffset, setWeekOffset] = useState(0);

  // Planned volume from the program's current cursor — what the lifter
  // intends to do this week, independent of what's been logged so far.
  const plannedVolume = useMemo(() => computePlannedWeeklyVolume(program), [program]);

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

  // Fatigue flags — single rule lives in `lib/progressSignal#fatigueSignal`.
  const fatigueFlags = useMemo(() => {
    const flags: Record<string, boolean> = {};
    for (const lift of MAIN_LIFTS) {
      // Find any logged Exercise object matching this main-lift name.
      let exercise: { id: string; name: string } | undefined;
      for (const s of sessions) {
        const match = s.exercises.find((e) => e.exercise.name === lift);
        if (match) {
          exercise = match.exercise;
          break;
        }
      }
      flags[lift] = exercise
        ? fatigueSignal(sessions, exercise as Parameters<typeof fatigueSignal>[1]) !== null
        : false;
    }
    return flags;
  }, [sessions]);

  // Weekly volume — domain rule lives in `lib/volume`.
  const weekData = useMemo(() => {
    const volume = computeWeeklyVolume(sessions, { weekOffset });
    // Avg-RPE-per-day is a separate concern from working-set volume; computed inline.
    const dayRpes: Record<string, number[]> = {};
    for (const session of sessions) {
      if (session.startTime < volume.start.getTime() || session.startTime > volume.end.getTime()) continue;
      const dayKey = new Date(session.startTime).toLocaleDateString('en-GB', { weekday: 'short' });
      for (const ex of session.exercises) {
        for (const set of ex.sets) {
          if (!set.completed) continue;
          if (!dayRpes[dayKey]) dayRpes[dayKey] = [];
          dayRpes[dayKey].push(set.rpe);
        }
      }
    }
    const rpeByDay = Object.entries(dayRpes).map(([day, rpes]) => ({
      day,
      avgRpe: +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1),
    }));
    return { ...volume, rpeByDay };
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
          {(() => {
            const allGroups = Object.keys(VOLUME_LANDMARKS) as MuscleGroup[];
            // Show every muscle that has logged sets, has planned sets this
            // week, OR has a non-zero MEV to flag. Collapse the truly idle
            // (sets=0, planned=0, mev=0) into the "Untrained" footer.
            const visible: MuscleGroup[] = [];
            const collapsed: MuscleGroup[] = [];
            for (const g of allGroups) {
              const done = weekData.perMuscleGroup[g] ?? 0;
              const planned = plannedVolume[g] ?? 0;
              const mev = VOLUME_LANDMARKS[g]?.mev ?? 0;
              if (done > 0 || planned > 0 || mev > 0) visible.push(g);
              else collapsed.push(g);
            }
            const byRegion: Record<MuscleRegion, MuscleGroup[]> = { Lower: [], Push: [], Pull: [], Core: [] };
            for (const g of visible) byRegion[MUSCLE_REGION[g]].push(g);
            for (const region of MUSCLE_REGION_ORDER) byRegion[region].sort();

            if (visible.length === 0) {
              return <p className="text-sm text-muted-foreground text-center py-4">No data this week</p>;
            }

            return (
              <div className="flex flex-col gap-4">
                <VolumeBarLegend />
                {MUSCLE_REGION_ORDER.map((region) => {
                  const groups = byRegion[region];
                  if (groups.length === 0) return null;
                  return (
                    <div key={region} className="flex flex-col gap-3.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 pb-1 border-b border-border/50">
                        {region}
                      </div>
                      {groups.map((group) => (
                        <VolumeBar
                          key={group}
                          group={group}
                          done={weekData.perMuscleGroup[group] ?? 0}
                          planned={plannedVolume[group] ?? 0}
                        />
                      ))}
                    </div>
                  );
                })}
                {collapsed.length > 0 && (
                  <div className="text-xs text-muted-foreground/70 italic pt-1">
                    Untrained ({collapsed.length}): {collapsed.join(', ')}
                  </div>
                )}
              </div>
            );
          })()}

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

/**
 * Single muscle-group row: name + done/planned counts, a stacked bar with
 * MEV / MAV / MRV markers, and a "planned" indicator above the bar.
 *
 * Bar layout (0 → ceiling, ceiling = MRV * 1.15 so over-MRV still has room
 * to draw past the MRV tick):
 *   - empty rail bg-secondary
 *   - filled = done sets, coloured by VolumeStatus
 *   - vertical ticks at MEV / MAV / MRV
 *   - small triangle marker above bar at the planned-sets position
 */
function VolumeBar({ group, done, planned }: { group: MuscleGroup; done: number; planned: number }) {
  const landmarks = VOLUME_LANDMARKS[group];
  const status = classifyVolume(done, landmarks);
  // Rail extends past MRV so over-MRV bars and any planned-marker beyond MRV
  // are visible. If no landmarks, fall back to a fixed ceiling.
  const mrv = landmarks?.mrv ?? 20;
  const ceiling = Math.max(mrv * 1.15, done, planned, mrv + 2);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / ceiling) * 100))}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1.5">
        <span className="text-foreground font-medium">{group}</span>
        <span className="text-muted-foreground tabular-nums text-xs">
          <span className="text-foreground font-semibold">{done}</span>
          <span className="opacity-50"> / </span>
          <span>{planned}</span>
          <span className="opacity-60"> planned</span>
        </span>
      </div>

      {/* Planned marker rail (slim, sits above the bar) */}
      <div className="relative h-2 mb-0.5">
        {planned > 0 && (
          <div
            className="absolute -top-px"
            style={{ left: pct(planned), transform: 'translateX(-50%)' }}
            title={`Planned: ${planned} sets`}
            aria-label={`Planned ${planned} sets`}
          >
            <svg width="10" height="8" viewBox="0 0 10 8" className="text-primary">
              <path d="M5 8 L0 0 L10 0 Z" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>

      {/* Main bar */}
      <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn('absolute left-0 top-0 h-full rounded-full transition-all', VOLUME_BAR_COLOR[status])}
          style={{ width: pct(done) }}
        />
        {landmarks && landmarks.mev > 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/40"
            style={{ left: pct(landmarks.mev) }}
            aria-hidden
          />
        )}
        {landmarks && (
          <div
            className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-foreground"
            style={{ left: pct(landmarks.mav), transform: 'translateX(-1px)' }}
            aria-hidden
          />
        )}
        {landmarks && (
          <div
            className="absolute top-0 bottom-0 w-px bg-warning"
            style={{ left: pct(landmarks.mrv) }}
            aria-hidden
          />
        )}
      </div>

      {/* Tick scale below bar */}
      {landmarks && (
        <div className="relative h-3 mt-0.5 text-[9px] text-muted-foreground/80 tabular-nums">
          {landmarks.mev > 0 && (
            <span
              className="absolute"
              style={{ left: pct(landmarks.mev), transform: 'translateX(-50%)' }}
            >
              {landmarks.mev}
            </span>
          )}
          <span
            className="absolute font-semibold text-foreground/80"
            style={{ left: pct(landmarks.mav), transform: 'translateX(-50%)' }}
          >
            {landmarks.mav}
          </span>
          <span
            className="absolute"
            style={{ left: pct(landmarks.mrv), transform: 'translateX(-50%)' }}
          >
            {landmarks.mrv}
          </span>
        </div>
      )}
    </div>
  );
}

function VolumeBarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 pb-1">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-success" /> Done
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="8" viewBox="0 0 10 8" className="text-primary">
          <path d="M5 8 L0 0 L10 0 Z" fill="currentColor" />
        </svg>
        Planned
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-px h-3 bg-foreground/40" /> MEV
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-[2px] h-3 bg-foreground" /> MAV (target)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-px h-3 bg-warning" /> MRV
      </span>
    </div>
  );
}
