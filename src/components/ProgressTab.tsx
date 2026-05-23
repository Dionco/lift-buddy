import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import {
  MAIN_LIFTS,
  Exercise,
  MuscleGroup,
  MUSCLE_REGION,
  MUSCLE_REGION_ORDER,
  MuscleRegion,
  Session,
  SetLog,
} from '@/types/training';
import { e1rm, topSet } from '@/lib/e1rm';
import { avgRpe } from '@/lib/sessionStats';
import { fatigueSignal, progressSignal, repRangeBucket } from '@/lib/progressSignal';
import { getCurrentLocation } from '@/lib/programCursor';
import {
  computeWeeklyVolume,
  computePlannedWeeklyVolume,
  classifyVolume,
  isWorkingSet,
  VOLUME_LANDMARKS,
} from '@/lib/volume';

/* ════════════════════════════════════════════════════════════════════════════
   Progress tab — redesign (handoff from Claude Design).

   Sections, top → bottom: header + block context · block-phase rail ·
   per-lift strength-signal cards · fatigue radar · weekly volume against
   MEV/MAV/MRV landmarks · 7-day readiness · recent PRs.

   Everything is derived from the Zustand store through the existing domain
   lib modules — no mock data. The prototype's iOS frame and Tweaks panel are
   chrome and are intentionally not ported.
   ════════════════════════════════════════════════════════════════════════════ */

const HIDDEN_MUSCLES_KEY = 'lift-buddy:progress:hidden-muscles';
const MINUS = '−';

type RangeKey = '4W' | '8W' | 'BLOCK';
const RANGE_WEEKS: Record<RangeKey, number> = { '4W': 4, '8W': 8, BLOCK: 520 };

/** Signed number with a typographic minus, e.g. `+5.4` / `−4.2`. */
function fmtSigned(n: number, digits = 1): string {
  const fixed = Math.abs(n).toFixed(digits);
  if (n > 0) return `+${fixed}`;
  if (n < 0) return `${MINUS}${fixed}`;
  return `±${fixed}`;
}

const BUCKET_LABEL: Record<string, string> = { '1-5': '1–5', '6-10': '6–10', '11+': '11+' };

const PHASE_ABBREV: Record<string, string> = {
  Accumulation: 'ACC',
  Intensification: 'INT',
  Intensity: 'INT',
  Realization: 'RLZ',
  Realisation: 'RLZ',
  Peaking: 'PEAK',
  Deload: 'DLD',
  Hypertrophy: 'HYP',
  Strength: 'STR',
  Volume: 'VOL',
};
function phaseAbbrev(name: string): string {
  return PHASE_ABBREV[name.trim()] ?? name.trim().slice(0, 3).toUpperCase();
}

function relativeWhen(ts: number, now = Date.now()): string {
  const days = Math.floor((now - ts) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

function findExercise(sessions: Session[], name: string): Exercise | undefined {
  for (const s of sessions) {
    const match = s.exercises.find((e) => e.exercise.name === name);
    if (match) return match.exercise;
  }
  return undefined;
}

// ─── Sparkline ──────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return null;
  const w = 320;
  const h = 56;
  const padY = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.001, max - min);
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = padY + (1 - (v - min) / range) * (h - padY * 2);
    return [x, y] as const;
  });
  const pathD = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const fillD = `${pathD} L${w},${h} L0,${h} Z`;
  const [lastX, lastY] = pts[pts.length - 1];
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg className="lift-spark-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1={h - padY}
        x2={w}
        y2={h - padY}
        stroke="var(--rule)"
        strokeWidth="0.6"
        strokeDasharray="2 3"
      />
      <path d={fillD} fill={`url(#${gradId})`} />
      {pts.slice(0, -1).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill="var(--card-fill)" stroke={color} strokeWidth="1" />
      ))}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="3.5" fill={color} />
      <circle cx={lastX} cy={lastY} r="6" fill={color} fillOpacity="0.15" />
    </svg>
  );
}

// ─── Section helper ─────────────────────────────────────────────────────────
function Section({
  title,
  hint,
  padded = true,
  children,
}: {
  title: string;
  hint?: string;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div className="prog-section">
        <span className="prog-section-title">{title}</span>
        {hint && <span className="prog-section-hint">{hint}</span>}
      </div>
      <div className="prog-section-rule" />
      {padded ? <div style={{ padding: '0 18px' }}>{children}</div> : children}
    </>
  );
}

// ─── Strength-signal lift card ──────────────────────────────────────────────
interface LiftCardModel {
  name: string;
  e1rm: number;
  delta: number;
  trend: 'up' | 'flat' | 'down';
  slope: string;
  windowSessions: number;
  bucket: string;
  lastTopSet: { weight: number; reps: number; rpe: number } | null;
  isPR: boolean;
  sparkValues: number[];
  fatigue: { sessions: number; deltaKg: number } | null;
}

function LiftCard({ lift }: { lift: LiftCardModel }) {
  const trendCls =
    lift.trend === 'up' ? 'is-up' : lift.trend === 'down' ? 'is-down' : 'is-flat';
  const trendArrow = lift.trend === 'up' ? '↑' : lift.trend === 'down' ? '↓' : '→';
  const color =
    lift.trend === 'up'
      ? 'var(--trend-up)'
      : lift.trend === 'down'
        ? 'var(--trend-down)'
        : 'var(--ink-2)';
  return (
    <div className={`lift-card ${lift.fatigue ? 'is-fatigued' : ''}`}>
      <div className="lift-card-top">
        <div style={{ minWidth: 0 }}>
          <div className="lift-card-head">
            <span className="lift-card-name">{lift.name}</span>
            <span className="lift-card-bucket">{lift.bucket} reps</span>
            {lift.isPR && <span className="lift-card-pr-inline">{'★'} PR</span>}
          </div>
          <div className="lift-card-e1rm">
            <span className="lift-card-e1rm-val tabular-nums">{lift.e1rm}</span>
            <span className="lift-card-e1rm-unit">kg</span>
            <span className="lift-card-e1rm-label">e1RM</span>
          </div>
        </div>
        <div className="lift-card-trend">
          <span className={`lift-card-trend-badge ${trendCls}`}>
            <span>{trendArrow}</span>
            <span className="tabular-nums">{fmtSigned(lift.delta)} kg</span>
          </span>
          <span className="lift-card-trend-meta">{lift.slope}</span>
          <span className="lift-card-trend-meta">{lift.windowSessions} sessions</span>
        </div>
      </div>
      {lift.sparkValues.length >= 2 && (
        <div className="lift-card-spark">
          <Sparkline values={lift.sparkValues} color={color} />
        </div>
      )}
      <div className="lift-card-foot">
        <span>Last top set</span>
        <span>
          {lift.lastTopSet ? (
            <>
              <span className="lift-card-foot-val">
                {lift.lastTopSet.weight}kg {'×'} {lift.lastTopSet.reps}
              </span>
              {` · RPE ${lift.lastTopSet.rpe}`}
            </>
          ) : (
            <span className="lift-card-foot-val">{'—'}</span>
          )}
        </span>
      </div>
      {lift.fatigue && (
        <div className="lift-card-flag">
          <span className="lift-card-flag-mark" />
          <span className="lift-card-flag-text">
            <span className="lift-card-flag-strong">Fatigue signal</span>
            {` · e1RM down across ${lift.fatigue.sessions} sessions (${fmtSigned(
              lift.fatigue.deltaKg,
            )} kg).`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Fatigue radar ──────────────────────────────────────────────────────────
interface RadarSignal {
  name: string;
  sub: string;
  val: string;
  on: boolean;
}

function FatigueRadar({ signals }: { signals: RadarSignal[] }) {
  const onCount = signals.filter((s) => s.on).length;
  const deloadAdvised = onCount >= 2;
  return (
    <div className="fatigue-radar">
      <div className="fr-head">
        <div>
          <div className="fr-eyebrow">Fatigue radar</div>
          <div className="fr-title">{deloadAdvised ? 'Deload recommended' : 'Watching fatigue'}</div>
        </div>
        <div className="fr-score">
          <span className="fr-score-val tabular-nums">{onCount}</span>
          <span className="fr-score-tot">of {signals.length} signals</span>
        </div>
      </div>
      <div className="fr-signals">
        {signals.map((s) => (
          <div key={s.name} className={`fr-signal ${s.on ? 'is-on' : ''}`}>
            <span className="fr-signal-tick">{s.on ? '!' : '·'}</span>
            <div className="fr-signal-body">
              <div className="fr-signal-name">{s.name}</div>
              <div className="fr-signal-sub">{s.sub}</div>
            </div>
            <div className="fr-signal-val">{s.val}</div>
          </div>
        ))}
      </div>
      {deloadAdvised && (
        <button type="button" className="fr-cta">
          <span>
            <span className="fr-cta-label">Action</span>
            <span className="fr-cta-text" style={{ display: 'block' }}>
              Schedule a deload week
            </span>
          </span>
          <span className="fr-cta-arrow">{'→'}</span>
        </button>
      )}
    </div>
  );
}

// ─── Volume ─────────────────────────────────────────────────────────────────
interface MuscleModel {
  name: MuscleGroup;
  done: number;
  planned: number;
  mev: number;
  mav: number;
  mrv: number;
}

function MuscleBar({ m, onRemove }: { m: MuscleModel; onRemove: (name: MuscleGroup) => void }) {
  const status = classifyVolume(m.done, { mev: m.mev, mav: m.mav, mrv: m.mrv });
  const zone =
    status === 'below-mev'
      ? 'under'
      : status === 'in-mav'
        ? 'good'
        : status === 'near-mrv'
          ? 'warn'
          : 'over';
  const ceiling = Math.max(m.mrv * 1.15, m.done, m.planned, m.mrv + 2);
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / ceiling) * 100))}%`;
  return (
    <div className="vol-muscle">
      <button
        type="button"
        className="vm-remove"
        onClick={() => onRemove(m.name)}
        aria-label={`Hide ${m.name} from volume tracking`}
        title={`Hide ${m.name}`}
      >
        {'×'}
      </button>
      <div className="vm-row">
        <span className="vm-name">{m.name}</span>
        <span className="vm-vals tabular-nums">
          <span className="vm-done">{m.done}</span>
          <span className="vm-slash">/</span>
          <span className="vm-target">{m.planned}</span>
          <span className="vm-label">planned</span>
        </span>
      </div>
      <div className="vm-bar">
        <div className={`vm-bar-fill zone-${zone}`} style={{ width: pct(m.done) }} />
        {m.mev > 0 && <div className="vm-tick vm-tick-mev" style={{ left: pct(m.mev) }} />}
        <div className="vm-tick vm-tick-mav" style={{ left: pct(m.mav) }} />
        <div className="vm-tick vm-tick-mrv" style={{ left: pct(m.mrv) }} />
        {m.planned > 0 && <div className="vm-tick-plan" style={{ left: pct(m.planned) }} />}
      </div>
      <div className="vm-scale">
        {m.mev > 0 && (
          <div className="vm-scale-mark" style={{ left: pct(m.mev) }}>
            <span className="vm-scale-mark-letter">MEV</span>
            <span className="vm-scale-mark-num">{m.mev}</span>
          </div>
        )}
        <div className="vm-scale-mark is-mav" style={{ left: pct(m.mav) }}>
          <span className="vm-scale-mark-letter">MAV</span>
          <span className="vm-scale-mark-num">{m.mav}</span>
        </div>
        <div className="vm-scale-mark" style={{ left: pct(m.mrv) }}>
          <span className="vm-scale-mark-letter">MRV</span>
          <span className="vm-scale-mark-num">{m.mrv}</span>
        </div>
      </div>
    </div>
  );
}

function VolumeRegion({
  region,
  visible,
  hidden,
  onRemove,
  onAdd,
}: {
  region: MuscleRegion;
  visible: MuscleModel[];
  hidden: MuscleGroup[];
  onRemove: (name: MuscleGroup) => void;
  onAdd: (name: MuscleGroup) => void;
}) {
  const totalDone = visible.reduce((a, m) => a + m.done, 0);
  const totalPlan = visible.reduce((a, m) => a + m.planned, 0);
  return (
    <div className="vol-region">
      <div className="vol-region-head">
        <span className="vol-region-name">{region}</span>
        <span className="vol-region-count">
          <span className="vol-region-count-val tabular-nums">{totalDone}</span>
          {' / '}
          <span className="tabular-nums">{totalPlan}</span> sets
        </span>
      </div>
      {visible.length === 0 && (
        <div className="vol-muscle">
          <div className="vm-add-empty">
            All {region.toLowerCase()} muscles hidden {'—'} add some back below.
          </div>
        </div>
      )}
      {visible.map((m) => (
        <MuscleBar key={m.name} m={m} onRemove={onRemove} />
      ))}
      {hidden.length > 0 && (
        <div className="vm-add-row">
          <div className="vm-add-label">Hidden {'·'} tap to add back</div>
          <div className="vm-add-chips">
            {hidden.map((name) => (
              <button
                key={name}
                type="button"
                className="vm-add-chip"
                onClick={() => onAdd(name)}
                title={`Show ${name}`}
              >
                <span className="vm-add-chip-plus">+</span>
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Readiness ──────────────────────────────────────────────────────────────
function classifyReadiness(metric: 'sleep' | 'energy' | 'soreness', value: number): string {
  if (metric === 'sleep') return value < 6 ? 'low' : value < 7.5 ? 'ok' : 'good';
  if (metric === 'energy') return value <= 2 ? 'low' : value === 3 ? 'ok' : 'good';
  return value >= 4 ? 'low' : value === 3 ? 'ok' : 'good';
}

function ReadinessRow({
  label,
  unit,
  values,
  metric,
  scale,
}: {
  label: string;
  unit: string;
  values: number[];
  metric: 'sleep' | 'energy' | 'soreness';
  scale: number;
}) {
  const latest = values[values.length - 1];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    <div className="read-row">
      <div>
        <div className="read-row-label">{label}</div>
        <div className="read-row-label-val tabular-nums">
          {Number.isInteger(latest) ? latest : latest.toFixed(1)}
          <span className="read-row-label-unit">{unit}</span>
        </div>
      </div>
      <div className="read-row-spark">
        {values.map((v, i) => (
          <div
            key={i}
            className={`rs-bar is-${classifyReadiness(metric, v)} ${
              i === values.length - 1 ? 'is-today' : ''
            }`}
            style={{ height: `${Math.max(8, (v / scale) * 100)}%` }}
            title={`${v}${unit}`}
          />
        ))}
      </div>
      <div className="read-row-trend">
        <div className="read-row-trend-val tabular-nums">{avg.toFixed(1)}</div>
        <div className="read-row-trend-label">avg</div>
      </div>
    </div>
  );
}

// ─── Pure week-stats helper ─────────────────────────────────────────────────
interface WeekStats {
  start: Date;
  end: Date;
  totalKg: number;
  perMuscleGroup: Partial<Record<MuscleGroup, number>>;
  workingSets: number;
  avgRpe: number | null;
  sessionCount: number;
}

function weekStats(sessions: Session[], weekOffset: number): WeekStats {
  const volume = computeWeeklyVolume(sessions, { weekOffset });
  const startMs = volume.start.getTime();
  const endMs = volume.end.getTime();
  let workingSets = 0;
  let sessionCount = 0;
  const rpeSets: SetLog[] = [];
  for (const s of sessions) {
    if (s.startTime < startMs || s.startTime > endMs) continue;
    sessionCount++;
    for (const log of s.exercises) {
      for (const set of log.sets) {
        if (set.completed) rpeSets.push(set);
        if (isWorkingSet(set)) workingSets++;
      }
    }
  }
  return {
    start: volume.start,
    end: volume.end,
    totalKg: volume.totalKg,
    perMuscleGroup: volume.perMuscleGroup,
    workingSets,
    avgRpe: avgRpe(rpeSets),
    sessionCount,
  };
}

const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ─── Main tab ───────────────────────────────────────────────────────────────
export function ProgressTab() {
  const { sessions, program } = useTrainingStore();
  const [range, setRange] = useState<RangeKey>('4W');
  const [weekOffset, setWeekOffset] = useState(0);

  // Hidden muscles — persisted so the lifter's tracking preferences survive
  // reloads. Add-back via the chips at the bottom of each region.
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_MUSCLES_KEY);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_MUSCLES_KEY, JSON.stringify([...hidden]));
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }, [hidden]);
  const hideMuscle = (name: MuscleGroup) => setHidden((s) => new Set([...s, name]));
  const showMuscle = (name: MuscleGroup) =>
    setHidden((s) => {
      const next = new Set(s);
      next.delete(name);
      return next;
    });

  // ── Program / block context ───────────────────────────────────────────────
  const location = useMemo(() => getCurrentLocation(program), [program]);
  const blocks = program.blocks;

  // ── Strength-signal lift cards ────────────────────────────────────────────
  const liftCards = useMemo<LiftCardModel[]>(() => {
    const rangeWeeks = RANGE_WEEKS[range];
    const chrono = [...sessions].sort((a, b) => a.startTime - b.startTime);
    const out: LiftCardModel[] = [];
    for (const name of MAIN_LIFTS) {
      const ex = findExercise(sessions, name);
      if (!ex) continue;
      const samples: { e1rm: number; set: SetLog }[] = [];
      for (const s of chrono) {
        const log = s.exercises.find((e) => e.exercise.id === ex.id);
        if (!log) continue;
        const t = topSet(log.sets);
        if (!t) continue;
        samples.push({ e1rm: e1rm(t.weight, t.reps, t.rpe), set: t });
      }
      if (samples.length === 0) continue;

      const sig = progressSignal(sessions, ex, { weeks: rangeWeeks });
      const sparkValues =
        sig && sig.kind === 'main' ? sig.signal.e1rms : samples.map((s) => s.e1rm);
      const lastSample = samples[samples.length - 1];
      const currentE1rm = Math.round(lastSample.e1rm);
      const deltaRaw =
        sparkValues.length >= 2 ? sparkValues[sparkValues.length - 1] - sparkValues[0] : 0;

      let trend: 'up' | 'flat' | 'down';
      if (sig && sig.kind === 'main') trend = sig.signal.trending;
      else if (sig && sig.kind === 'accessory') trend = sig.signal.trending;
      else trend = deltaRaw > 0.5 ? 'up' : deltaRaw < -0.5 ? 'down' : 'flat';

      const slope =
        sig && sig.kind === 'main'
          ? `${fmtSigned(sig.signal.slopeKgPerSession)} kg/sess`
          : '—';
      const windowSessions =
        sig && sig.kind === 'main' ? sig.signal.windowSessions : samples.length;

      const maxE1rm = Math.max(...samples.map((s) => s.e1rm));
      const isPR = samples.length > 1 && lastSample.e1rm >= maxE1rm - 0.001;

      const fatigue = fatigueSignal(sessions, ex);

      out.push({
        name,
        e1rm: currentE1rm,
        delta: deltaRaw,
        trend,
        slope,
        windowSessions,
        bucket: BUCKET_LABEL[repRangeBucket(lastSample.set.reps)],
        lastTopSet: {
          weight: lastSample.set.weight,
          reps: lastSample.set.reps,
          rpe: lastSample.set.rpe,
        },
        isPR,
        sparkValues,
        fatigue: fatigue
          ? { sessions: fatigue.e1rms.length, deltaKg: fatigue.delta }
          : null,
      });
    }
    return out;
  }, [sessions, range]);

  // ── Weekly volume model ───────────────────────────────────────────────────
  const week = useMemo(() => weekStats(sessions, weekOffset), [sessions, weekOffset]);
  const priorWeeks = useMemo(
    () => [1, 2, 3, 4].map((i) => weekStats(sessions, weekOffset - i)),
    [sessions, weekOffset],
  );
  const plannedVolume = useMemo(() => computePlannedWeeklyVolume(program), [program]);
  const plannedSets = useMemo(
    () =>
      location
        ? location.week.days.reduce(
            (a, d) => a + d.exercises.reduce((b, pe) => b + pe.prescription.sets, 0),
            0,
          )
        : 0,
    [location],
  );

  const tonnageDelta = useMemo(() => {
    const trained = priorWeeks.filter((w) => w.sessionCount > 0);
    if (trained.length === 0 || week.totalKg === 0) return null;
    const avg = trained.reduce((a, w) => a + w.totalKg, 0) / trained.length;
    if (avg === 0) return null;
    return Math.round(((week.totalKg - avg) / avg) * 100);
  }, [priorWeeks, week]);

  const rpeDelta = useMemo(() => {
    if (week.avgRpe == null) return null;
    const trained = priorWeeks.filter((w) => w.avgRpe != null);
    if (trained.length === 0) return null;
    const avg = trained.reduce((a, w) => a + (w.avgRpe ?? 0), 0) / trained.length;
    return week.avgRpe - avg;
  }, [priorWeeks, week]);

  // Region-grouped muscle models — a muscle appears if it has logged volume,
  // planned volume, or a non-zero MEV worth flagging.
  const regions = useMemo(() => {
    const byRegion: Record<MuscleRegion, { visible: MuscleModel[]; hidden: MuscleGroup[] }> = {
      Lower: { visible: [], hidden: [] },
      Push: { visible: [], hidden: [] },
      Pull: { visible: [], hidden: [] },
      Core: { visible: [], hidden: [] },
    };
    for (const [name, landmarks] of Object.entries(VOLUME_LANDMARKS)) {
      if (!landmarks) continue;
      const group = name as MuscleGroup;
      const done = week.perMuscleGroup[group] ?? 0;
      const planned = plannedVolume[group] ?? 0;
      if (done === 0 && planned === 0 && landmarks.mev === 0) continue;
      const model: MuscleModel = {
        name: group,
        done,
        planned,
        mev: landmarks.mev,
        mav: landmarks.mav,
        mrv: landmarks.mrv,
      };
      const bucket = byRegion[MUSCLE_REGION[group]];
      if (hidden.has(group)) bucket.hidden.push(group);
      else bucket.visible.push(model);
    }
    for (const region of MUSCLE_REGION_ORDER) {
      byRegion[region].visible.sort((a, b) => a.name.localeCompare(b.name));
      byRegion[region].hidden.sort((a, b) => a.localeCompare(b));
    }
    return byRegion;
  }, [week, plannedVolume, hidden]);

  // ── Fatigue radar signals ─────────────────────────────────────────────────
  const radarSignals = useMemo<RadarSignal[]>(() => {
    // e1RM decline — first main lift firing the fatigue rule.
    let decline: { name: string; sessions: number; delta: number } | null = null;
    for (const name of MAIN_LIFTS) {
      const ex = findExercise(sessions, name);
      if (!ex) continue;
      const f = fatigueSignal(sessions, ex);
      if (f) {
        decline = { name, sessions: f.e1rms.length, delta: f.delta };
        break;
      }
    }

    // RPE drift — current week vs the trailing 4-week mean.
    const thisWeek = weekStats(sessions, 0);
    const prior = [1, 2, 3, 4]
      .map((i) => weekStats(sessions, -i))
      .filter((w) => w.avgRpe != null);
    let drift: number | null = null;
    if (thisWeek.avgRpe != null && prior.length > 0) {
      const avg = prior.reduce((a, w) => a + (w.avgRpe ?? 0), 0) / prior.length;
      drift = thisWeek.avgRpe - avg;
    }

    // Sleep / energy — mean of the last 3 readiness check-ins.
    const recent = sessions.filter((s) => s.readiness).slice(0, 3);
    const avgOf = (pick: (r: NonNullable<Session['readiness']>) => number) =>
      recent.length > 0
        ? recent.reduce((a, s) => a + pick(s.readiness!), 0) / recent.length
        : null;
    const avgSleep = avgOf((r) => r.sleep);
    const avgEnergy = avgOf((r) => r.energy);

    return [
      {
        name: 'e1RM decline',
        sub: decline ? `${decline.name} · ${decline.sessions} sessions` : 'No declines',
        val: decline ? `${fmtSigned(decline.delta)} kg` : '—',
        on: decline != null,
      },
      {
        name: 'RPE drift',
        sub: drift != null ? 'Same load, harder than 4w avg' : 'Not enough history',
        val: drift != null ? fmtSigned(drift) : '—',
        on: drift != null && drift > 0.3,
      },
      {
        name: 'Sleep deficit',
        sub: avgSleep != null ? `${avgSleep.toFixed(1)}h avg last 3` : 'No check-ins',
        val: avgSleep != null ? (avgSleep < 6.5 ? 'low' : 'ok') : '—',
        on: avgSleep != null && avgSleep < 6.5,
      },
      {
        name: 'Low energy',
        sub: avgEnergy != null ? `${avgEnergy.toFixed(1)}/5 avg last 3` : 'No check-ins',
        val: avgEnergy != null ? (avgEnergy <= 2.5 ? 'low' : 'ok') : '—',
        on: avgEnergy != null && avgEnergy <= 2.5,
      },
    ];
  }, [sessions]);

  // ── Readiness — last 7 check-ins, oldest first ────────────────────────────
  const readiness = useMemo(() => {
    const chrono = sessions
      .filter((s) => s.readiness)
      .slice(0, 7)
      .reverse();
    return {
      count: chrono.length,
      sleep: chrono.map((s) => s.readiness!.sleep),
      energy: chrono.map((s) => s.readiness!.energy),
      soreness: chrono.map((s) => s.readiness!.soreness),
    };
  }, [sessions]);
  const lowSleep = readiness.count > 0 && readiness.sleep[readiness.count - 1] < 6;
  const lowEnergy = readiness.count > 0 && readiness.energy[readiness.count - 1] <= 2;

  // ── Recent PRs — a new all-time-best top-set e1RM per exercise ─────────────
  const prs = useMemo(() => {
    const chrono = [...sessions].sort((a, b) => a.startTime - b.startTime);
    const best = new Map<string, { e1rm: number; weight: number }>();
    const events: {
      lift: string;
      reps: string;
      value: number;
      deltaKg: number;
      when: string;
      ts: number;
    }[] = [];
    for (const s of chrono) {
      for (const log of s.exercises) {
        const t = topSet(log.sets);
        if (!t) continue;
        const v = e1rm(t.weight, t.reps, t.rpe);
        const prev = best.get(log.exercise.id);
        if (prev && v > prev.e1rm + 0.01) {
          const weightGain = t.weight - prev.weight;
          events.push({
            lift: log.exercise.name,
            reps: `${t.reps}RM`,
            value: t.weight,
            deltaKg: weightGain > 0 ? weightGain : Math.round((v - prev.e1rm) * 2) / 2,
            when: relativeWhen(s.startTime),
            ts: s.startTime,
          });
        }
        if (!prev || v > prev.e1rm) best.set(log.exercise.id, { e1rm: v, weight: t.weight });
      }
    }
    return events.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [sessions]);

  const dayCount = location ? location.week.days.length : 0;

  return (
    <div className="prog">
      {/* ── Header ── */}
      <div className="prog-head">
        <div className="prog-head-top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="eyebrow">Progression</div>
            <div className="prog-head-title">Progress</div>
            {location && (
              <div className="prog-head-sub">
                <span className="prog-head-sub-val">{location.block.name}</span>
                <span className="prog-head-sub-dot">{'·'}</span>
                <span>
                  W<span className="prog-head-sub-val">{location.weekIndex + 1}</span>/
                  {location.block.weeks.length}
                </span>
                <span className="prog-head-sub-dot">{'·'}</span>
                <span>
                  D<span className="prog-head-sub-val">{location.dayIndex + 1}</span>/{dayCount}
                </span>
              </div>
            )}
          </div>
          <div className="prog-head-range">
            {(['4W', '8W', 'BLOCK'] as RangeKey[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`prog-head-range-btn ${range === r ? 'is-active' : ''}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Block phase rail ── */}
      {blocks.length > 0 && (
        <div className="phase-rail">
          <div className="phase-rail-bars">
            {blocks.map((b, bi) => {
              const status =
                bi < program.currentBlockIndex
                  ? 'past'
                  : bi === program.currentBlockIndex
                    ? 'current'
                    : 'future';
              const isCurrent = status === 'current';
              const fillPct = isCurrent
                ? ((program.currentWeekIndex + 1) / b.weeks.length) * 100
                : 0;
              return (
                <div key={b.id} className={`phase-bar is-${status}`}>
                  <div className="phase-bar-label">{phaseAbbrev(b.name)}</div>
                  <div className="phase-bar-meta">
                    {isCurrent
                      ? `W${program.currentWeekIndex + 1}/${b.weeks.length}`
                      : `${b.weeks.length}w`}
                  </div>
                  {isCurrent && (
                    <div className="phase-bar-week-fill" style={{ width: `${fillPct}%` }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="phase-rail-scale">
            <span>Cycle start</span>
            <span>Meet day</span>
          </div>
        </div>
      )}

      {/* ── Strength signal ── */}
      {liftCards.length > 0 && (
        <Section title="Strength signal" hint={`${liftCards.length} lifts`}>
          <div className="lift-grid">
            {liftCards.map((lift) => (
              <LiftCard key={lift.name} lift={lift} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Fatigue radar ── */}
      <Section title="Fatigue radar" padded={false}>
        <FatigueRadar signals={radarSignals} />
      </Section>

      {/* ── Weekly volume ── */}
      <Section title="Weekly volume" hint="vs MEV / MAV / MRV">
        <div className="vol-block">
          <div className={`vol-week ${weekOffset === 0 ? 'is-current' : ''}`}>
            <button
              type="button"
              className="vol-week-nav"
              onClick={() => setWeekOffset(weekOffset - 1)}
              aria-label="Previous week"
            >
              {'‹'}
            </button>
            <div className="vol-week-body">
              <div className="vol-week-label">
                {weekOffset === 0
                  ? 'This week'
                  : weekOffset === -1
                    ? 'Last week'
                    : `${-weekOffset} weeks ago`}
              </div>
              <div className="vol-week-dates">
                {fmtDate(week.start)} {'–'} {fmtDate(week.end)}
              </div>
            </div>
            <button
              type="button"
              className={`vol-week-nav ${weekOffset >= 0 ? 'is-disabled' : ''}`}
              onClick={() => weekOffset < 0 && setWeekOffset(weekOffset + 1)}
              disabled={weekOffset >= 0}
              aria-label="Next week"
            >
              {'›'}
            </button>
          </div>

          <div className="vol-totals">
            <div className="vol-total">
              <div className="vol-total-label">Working sets</div>
              <div className="vol-total-val tabular-nums">
                {week.workingSets}
                <span className="vol-total-unit">/ {plannedSets}</span>
              </div>
              <div className="vol-total-delta is-flat">RPE {'≥'} 7</div>
            </div>
            <div className="vol-total">
              <div className="vol-total-label">Tonnage</div>
              <div className="vol-total-val tabular-nums">
                {(week.totalKg / 1000).toFixed(1)}
                <span className="vol-total-unit">t</span>
              </div>
              <div
                className={`vol-total-delta ${
                  tonnageDelta == null
                    ? 'is-flat'
                    : tonnageDelta > 0
                      ? 'is-up'
                      : tonnageDelta < 0
                        ? 'is-down'
                        : 'is-flat'
                }`}
              >
                {tonnageDelta == null
                  ? 'no 4w history'
                  : `${fmtSigned(tonnageDelta, 0)}% vs 4w avg`}
              </div>
            </div>
            <div className="vol-total">
              <div className="vol-total-label">Avg RPE</div>
              <div className="vol-total-val tabular-nums">
                {week.avgRpe != null ? week.avgRpe.toFixed(1) : '—'}
              </div>
              <div
                className={`vol-total-delta ${
                  rpeDelta == null
                    ? 'is-flat'
                    : rpeDelta > 0.05
                      ? 'is-down'
                      : rpeDelta < -0.05
                        ? 'is-up'
                        : 'is-flat'
                }`}
              >
                {rpeDelta == null ? 'no 4w history' : `${fmtSigned(rpeDelta)} drift`}
              </div>
            </div>
          </div>

          <div className="vol-legend">
            <span className="vol-legend-item">
              <span className="vol-legend-sw is-under" />
              Below MEV
            </span>
            <span className="vol-legend-item">
              <span className="vol-legend-sw is-good" />
              In MAV
            </span>
            <span className="vol-legend-item">
              <span className="vol-legend-sw is-warn" />
              Approaching MRV
            </span>
            <span className="vol-legend-item">
              <span className="vol-legend-sw is-over" />
              Over MRV
            </span>
          </div>

          {MUSCLE_REGION_ORDER.map((region) => {
            const { visible, hidden: hiddenInRegion } = regions[region];
            if (visible.length === 0 && hiddenInRegion.length === 0) return null;
            return (
              <VolumeRegion
                key={region}
                region={region}
                visible={visible}
                hidden={hiddenInRegion}
                onRemove={hideMuscle}
                onAdd={showMuscle}
              />
            );
          })}
        </div>
      </Section>

      {/* ── Readiness ── */}
      {readiness.count > 0 && (
        <Section title="Readiness" hint={`last ${readiness.count} sessions`}>
          <div className="read-card">
            <ReadinessRow
              label="Sleep"
              unit="h"
              values={readiness.sleep}
              metric="sleep"
              scale={10}
            />
            <ReadinessRow
              label="Energy"
              unit="/5"
              values={readiness.energy}
              metric="energy"
              scale={5}
            />
            <ReadinessRow
              label="Soreness"
              unit="/5"
              values={readiness.soreness}
              metric="soreness"
              scale={5}
            />
            {(lowSleep || lowEnergy) && (
              <div className="read-flag">
                <span className="read-flag-mark">!</span>
                <span>
                  Today{"’"}s readiness is low.
                  {lowSleep && ' Sleep under 6h — reduce intensity 5–10%.'}
                  {lowEnergy &&
                    ' Energy ≤ 2 — trim volume 20–30% and skip PR attempts.'}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Recent PRs ── */}
      {prs.length > 0 && (
        <Section title="Recent PRs" hint={`${prs.length} recent`}>
          <div className="pr-list">
            {prs.map((pr, i) => (
              <div key={`${pr.lift}-${pr.ts}-${i}`} className="pr-row">
                <div className="pr-mark">PR</div>
                <div>
                  <div className="pr-name">{pr.lift}</div>
                  <div className="pr-meta">
                    {pr.reps} {'·'} {pr.when}
                  </div>
                </div>
                <div>
                  <div className="pr-val tabular-nums">
                    {pr.value}
                    <span className="pr-val-unit">kg</span>
                  </div>
                  <div className="pr-val-delta">{fmtSigned(pr.deltaKg)} kg</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="prog-bottom-pad" />
    </div>
  );
}
