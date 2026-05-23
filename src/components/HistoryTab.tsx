import { useMemo, useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { Exercise, MAIN_LIFTS, SetLog, Session } from '@/types/training';
import { e1rm, topSet } from '@/lib/e1rm';
import { sessionStats, SessionStats } from '@/lib/sessionStats';
import { formatMuscles } from '@/lib/muscleLabels';

/* ════════════════════════════════════════════════════════════════════════════
   History tab — redesign (handoff from Claude Design / claude.ai/design).

   Sections, top → bottom: header + range stats · per-lift trend strip ·
   volume-heatmap calendar (month grid / week strip) · phase + PR + fatigue
   filter chips · week-grouped session cards with an inline-expand detail view.

   Everything is derived from the Zustand store. Program phase and week are
   parsed from the Session's workoutName; PR / fatigue / deload markers and
   e1RM deltas are computed by walking the Session history. The prototype's
   iOS frame and Tweaks panel are chrome and are intentionally not ported.
   ════════════════════════════════════════════════════════════════════════════ */

const DAY_MS = 86_400_000;
const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_MINI = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Phase words recognised when parsing a Session's workoutName. */
const PHASE_WORDS = new Set([
  'accumulation', 'intensification', 'intensity', 'realization', 'realisation',
  'peaking', 'deload', 'hypertrophy', 'strength', 'volume', 'base', 'taper',
]);
const PHASE_ABBREV: Record<string, string> = {
  Accumulation: 'Accum',
  Intensification: 'Intens',
  Intensity: 'Intens',
  Realization: 'Realiz',
  Realisation: 'Realiz',
  Peaking: 'Peak',
  Hypertrophy: 'Hyper',
  Deload: 'Deload',
  Strength: 'Strength',
  Volume: 'Volume',
};

type RangeKey = '1W' | '4W' | '12W';
const RANGE_DAYS: Record<RangeKey, number> = { '1W': 7, '4W': 28, '12W': 84 };
type StateFilter = 'PR' | 'Fatigued' | 'Deload';
type CalMode = 'month' | 'week';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dayKey(ts: number): number {
  const d = new Date(ts);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function dateFromKey(k: number): Date {
  return new Date(Math.floor(k / 10000), Math.floor((k % 10000) / 100) - 1, k % 100);
}
function monthLabel(d: Date): string {
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** Monday-anchored start-of-week timestamp (local midnight). */
function weekStartTs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
function fmtWeekRange(weekStart: number): string {
  const s = new Date(weekStart);
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTH_SHORT[s.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]}`;
}
/** Shift a week-anchor timestamp by whole weeks, staying on local midnight. */
function shiftWeek(anchor: number, deltaWeeks: number): number {
  const d = new Date(anchor);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + deltaWeeks * 7).getTime();
}

/** Lifts read as `Bench` / `DL` / `Squat` on chips and PR tags. */
function liftAbbrev(name: string): string {
  if (name === 'Bench Press') return 'Bench';
  if (name === 'Deadlift') return 'DL';
  return name;
}
/** The block-style tag in a card's main-lift line: `SQUAT` / `BENCH` / … */
function liftTag(name: string): string {
  return (name === 'Bench Press' ? 'Bench' : name).toUpperCase();
}

interface ParsedName {
  phase: string | null;
  week: string | null;
  title: string;
}
/**
 * Split a workoutName like `Accumulation · Week 2 · Day 1 — Squat` into its
 * program phase, week label, and the human title. Names without ` · ` separators
 * (free-form Sessions) keep the whole string as the title.
 */
function parseWorkoutName(name: string | undefined): ParsedName {
  if (!name) return { phase: null, week: null, title: 'Workout' };
  const segs = name.split('·').map((s) => s.trim()).filter(Boolean);
  if (segs.length <= 1) return { phase: null, week: null, title: name.trim() };
  let phase: string | null = null;
  let week: string | null = null;
  const rest: string[] = [];
  for (const seg of segs) {
    const wk = seg.match(/^week\s+(\d+)$/i);
    if (wk) {
      week = `Wk ${wk[1]}`;
      continue;
    }
    if (!phase && PHASE_WORDS.has(seg.toLowerCase())) {
      phase = seg;
      continue;
    }
    rest.push(seg);
  }
  return { phase, week, title: rest.join(' · ') || segs[segs.length - 1] };
}

// ─── Per-Session derived model ────────────────────────────────────────────────

interface MainLiftEntry {
  exercise: Exercise;
  top: SetLog;
  e1rm: number;
}
interface HistSession {
  session: Session;
  stats: SessionStats;
  phase: string | null;
  week: string | null;
  title: string;
  /** Main lifts that set a new all-time-best top-set e1RM in this Session. */
  prs: string[];
  /** Per main lift, top-set e1RM change vs the lifter's previous Session with it. */
  deltas: Record<string, number>;
  /** A main lift was ground out at RPE ≥ 9 yet e1RM went backwards. */
  fatigued: boolean;
  deload: boolean;
  mainLifts: MainLiftEntry[];
}

/** Build the enriched, PR-annotated view of every Session, keyed by Session id. */
function buildModel(sessions: Session[]): Map<string, HistSession> {
  const chrono = [...sessions].sort((a, b) => a.startTime - b.startTime);
  const best: Record<string, number> = {};
  const prev: Record<string, number> = {};
  const out = new Map<string, HistSession>();
  for (const session of chrono) {
    const stats = sessionStats(session);
    const { phase, week, title } = parseWorkoutName(session.workoutName);
    const prs: string[] = [];
    const deltas: Record<string, number> = {};
    const mainLifts: MainLiftEntry[] = [];
    let fatigued = false;
    for (const log of session.exercises) {
      if (!log.exercise.isMainLift) continue;
      const top = topSet(log.sets);
      if (!top) continue;
      const e = e1rm(top.weight, top.reps, top.rpe);
      mainLifts.push({ exercise: log.exercise, top, e1rm: e });
      const name = log.exercise.name;
      if (prev[name] != null) deltas[name] = e - prev[name];
      if ((best[name] ?? 0) > 0 && e > best[name]) prs.push(name);
      if (top.rpe >= 9 && (deltas[name] ?? 0) < 0) fatigued = true;
      best[name] = Math.max(best[name] ?? 0, e);
      prev[name] = e;
    }
    const deload =
      /deload/i.test(session.workoutName ?? '') || phase?.toLowerCase() === 'deload';
    out.set(session.id, {
      session, stats, phase, week, title, prs, deltas, fatigued, deload, mainLifts,
    });
  }
  return out;
}

// ─── Calendar heatmap ─────────────────────────────────────────────────────────

interface DayCell {
  key: number;
  volume: number;
  count: number;
  hasPr: boolean;
}

/** Map volume → a 0–5 heat level, scaled against the busiest day on record. */
function intensityLevel(volume: number, maxVolume: number): number {
  if (!volume || maxVolume <= 0) return 0;
  const pct = volume / maxVolume;
  if (pct < 0.18) return 1;
  if (pct < 0.36) return 2;
  if (pct < 0.55) return 3;
  if (pct < 0.78) return 4;
  return 5;
}

function CalLegend() {
  return (
    <div className="cal-legend">
      <span>Less</span>
      <span className="cal-legend-scale">
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={`cal-legend-sw lvl-${l}`} />
        ))}
      </span>
      <span>More</span>
      <span className="cal-legend-spacer" />
      <span className="cal-legend-pr">
        <span className="cal-legend-pr-dot" /> PR
      </span>
    </div>
  );
}

function CalHead({
  label, subLabel, mode, onPrev, onNext, onMode, nextDisabled,
}: {
  label: string;
  subLabel: string;
  mode: CalMode;
  onPrev: () => void;
  onNext: () => void;
  onMode: (m: CalMode) => void;
  nextDisabled: boolean;
}) {
  return (
    <>
      <div className="cal-head">
        <div>
          <div className="cal-head-label">{label}</div>
          <div className="cal-head-sub">{subLabel}</div>
        </div>
        <div className="cal-head-nav">
          <button type="button" className="cal-nav" onClick={onPrev} aria-label="Previous month">
            ‹
          </button>
          <button
            type="button"
            className={`cal-nav ${nextDisabled ? 'is-disabled' : ''}`}
            onClick={() => !nextDisabled && onNext()}
            disabled={nextDisabled}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>
      <div className="cal-mode">
        <span className="cal-mode-label">Intensity by volume</span>
        <div className="cal-mode-seg">
          {(['month', 'week'] as CalMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`cal-mode-seg-btn ${mode === m ? 'is-active' : ''}`}
              onClick={() => onMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function CalendarHeatmap({
  monthDate, weekAnchor, dayData, maxVolume, monthCount, selectedKey, mode, now,
  onPrev, onNext, onMode, onSelect,
}: {
  monthDate: Date;
  weekAnchor: number;
  dayData: Map<number, DayCell>;
  maxVolume: number;
  monthCount: number;
  selectedKey: number | null;
  mode: CalMode;
  now: number;
  onPrev: () => void;
  onNext: () => void;
  onMode: (m: CalMode) => void;
  onSelect: (k: number) => void;
}) {
  const todayKey = dayKey(now);

  if (mode === 'week') {
    // Seven days from the Monday-anchored week, built with calendar arithmetic
    // so the strip stays correct across DST boundaries.
    const base = new Date(weekAnchor);
    const cells = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const ts = d.getTime();
      const key = dayKey(ts);
      const data = dayData.get(key);
      return {
        key,
        day: d.getDate(),
        dow: DOW_SHORT[i],
        volume: data?.volume ?? 0,
        hasPr: data?.hasPr ?? false,
        isFuture: ts > now,
      };
    });
    const maxWeekVol = Math.max(1, ...cells.map((c) => c.volume));
    const nextDisabled = shiftWeek(weekAnchor, 1) > weekStartTs(now);
    return (
      <div className="cal-wrap">
        <CalHead
          label={monthLabel(base)} subLabel={fmtWeekRange(weekAnchor)} mode={mode}
          onPrev={onPrev} onNext={onNext} onMode={onMode} nextDisabled={nextDisabled}
        />
        <div className="cal-week-strip">
          {cells.map((c) => {
            const lvl = intensityLevel(c.volume, maxVolume);
            const barH = c.volume > 0 ? Math.round(8 + (c.volume / maxWeekVol) * 30) : 0;
            const active = !c.isFuture && c.volume > 0;
            return (
              <button
                key={c.key}
                type="button"
                className={`cal-ws-cell lvl-${lvl} ${c.isFuture ? 'is-empty' : ''} ${
                  selectedKey === c.key ? 'is-selected' : ''
                }`}
                onClick={() => active && onSelect(c.key)}
                disabled={!active}
              >
                <div className="cal-ws-cell-dow">{c.dow}</div>
                <div className="cal-ws-cell-day">{c.day}</div>
                <div className="cal-ws-cell-bar">
                  {barH > 0 && <div className="cal-ws-bar" style={{ height: barH }} />}
                </div>
                {c.hasPr && <div className="cal-ws-cell-pr" />}
              </button>
            );
          })}
        </div>
        <CalLegend />
      </div>
    );
  }

  // Month grid — six rows of seven, Monday-anchored.
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const nextDisabled = new Date(y, m + 1, 1) > new Date(now);
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const offset = i - firstDow;
    let cy = y;
    let cm = m;
    let cd: number;
    let outside = false;
    if (offset < 0) {
      outside = true;
      cd = prevDays + offset + 1;
      cm = m - 1;
      if (cm < 0) { cm = 11; cy = y - 1; }
    } else if (offset >= daysInMonth) {
      outside = true;
      cd = offset - daysInMonth + 1;
      cm = m + 1;
      if (cm > 11) { cm = 0; cy = y + 1; }
    } else {
      cd = offset + 1;
    }
    return { key: cy * 10000 + (cm + 1) * 100 + cd, day: cd, outside };
  });

  return (
    <div className="cal-wrap">
      <CalHead
        label={monthLabel(monthDate)}
        subLabel={`${monthCount} session${monthCount === 1 ? '' : 's'}`}
        mode={mode}
        onPrev={onPrev} onNext={onNext} onMode={onMode} nextDisabled={nextDisabled}
      />
      <div className="cal-grid">
        {DOW_MINI.map((d, i) => (
          <div key={i} className="cal-dow">{d}</div>
        ))}
        {cells.map((c) => {
          const data = c.outside ? undefined : dayData.get(c.key);
          const lvl = data ? intensityLevel(data.volume, maxVolume) : 0;
          const hasSessions = !!data && data.count > 0;
          const cls = [
            'cal-cell',
            `lvl-${lvl}`,
            c.outside ? 'is-outside' : '',
            c.key === todayKey ? 'is-today' : '',
            c.key === selectedKey ? 'is-selected' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={c.key}
              type="button"
              className={cls}
              onClick={() => hasSessions && onSelect(c.key)}
              disabled={!hasSessions}
              style={!hasSessions ? { cursor: 'default' } : undefined}
            >
              {c.day}
              {data?.hasPr && <div className="cal-cell-pr" />}
              {data && data.count > 1 && <div className="cal-cell-dot">×{data.count}</div>}
            </button>
          );
        })}
      </div>
      <CalLegend />
    </div>
  );
}

// ─── Trend strip ──────────────────────────────────────────────────────────────

interface TrendModel {
  name: string;
  series: number[];
  latest: number;
  delta: number;
  isPr: boolean;
}

function TrendCard({ trend, active, onClick }: {
  trend: TrendModel;
  active: boolean;
  onClick: () => void;
}) {
  const w = 100;
  const h = 22;
  const pts = trend.series.slice(-12);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = Math.max(1, max - min);
  const xs = pts.map((_, i) => (i / Math.max(1, pts.length - 1)) * w);
  const ys = pts.map((v) => h - 2 - ((v - min) / range) * (h - 4));
  const path = pts
    .map((_, i) => `${i === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ');

  const deltaCls = Math.abs(trend.delta) < 0.5 ? 'is-flat' : trend.delta > 0 ? 'is-up' : 'is-down';
  const arrow = trend.delta > 0.5 ? '↑' : trend.delta < -0.5 ? '↓' : '→';
  const short = trend.name === 'Bench Press' ? 'Bench' : trend.name === 'Deadlift' ? 'DL' : trend.name;

  return (
    <button type="button" className={`ts-card ${active ? 'is-active' : ''}`} onClick={onClick}>
      <div className="ts-card-name">{short}{trend.isPr ? ' · PR' : ''}</div>
      <div className="ts-card-val">
        <span className="ts-card-num tabular">{Math.round(trend.latest)}</span>
        <span className="ts-card-unit">kg e1RM</span>
      </div>
      <svg className="ts-card-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        <circle
          cx={xs[xs.length - 1]}
          cy={ys[ys.length - 1]}
          r="1.8"
          fill={trend.isPr ? 'var(--accent)' : 'var(--ink)'}
        />
      </svg>
      <div className={`ts-card-delta ${deltaCls}`}>
        {arrow} {trend.delta >= 0 ? '+' : ''}{Math.round(trend.delta)}kg
        <span className="ts-card-delta-meta"> · 4w</span>
      </div>
    </button>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function ReadinessPip({ label, value, low }: { label: string; value: string; low: boolean }) {
  return (
    <span className={`sc-read-pip ${low ? 'is-low' : ''}`}>
      <span>{label}</span>
      <span className="sc-read-pip-val">{value}</span>
    </span>
  );
}

function SessionDetail({ hs }: { hs: HistSession }) {
  const { session } = hs;
  const r = session.readiness;
  return (
    <div className="sc-detail">
      {r && (
        <div className="sc-detail-readiness">
          <div className={`sc-detail-readiness-cell ${r.sleep < 6 ? 'is-low' : ''}`}>
            <div className="sc-detail-readiness-label">Sleep</div>
            <div className="sc-detail-readiness-val">
              {r.sleep}<span className="sc-detail-readiness-unit">h</span>
            </div>
          </div>
          <div className={`sc-detail-readiness-cell ${r.energy <= 2 ? 'is-low' : ''}`}>
            <div className="sc-detail-readiness-label">Energy</div>
            <div className="sc-detail-readiness-val">
              {r.energy}<span className="sc-detail-readiness-unit">/5</span>
            </div>
          </div>
          <div className={`sc-detail-readiness-cell ${r.soreness >= 4 ? 'is-low' : ''}`}>
            <div className="sc-detail-readiness-label">Soreness</div>
            <div className="sc-detail-readiness-val">
              {r.soreness}<span className="sc-detail-readiness-unit">/5</span>
            </div>
          </div>
        </div>
      )}
      {session.exercises.map((ex, i) => {
        const completed = ex.sets.filter((s) => s.completed);
        if (completed.length === 0) return null;
        const top = topSet(ex.sets);
        const e = top ? e1rm(top.weight, top.reps, top.rpe) : 0;
        const totalVol = completed.reduce((sum, s) => sum + s.weight * s.reps, 0);
        return (
          <div key={i} className="sc-detail-block">
            <div className={`sc-detail-ex-head ${ex.exercise.isMainLift ? 'is-main' : ''}`}>
              {ex.exercise.isMainLift && <span className="sc-detail-ex-tag">Main</span>}
              <div>
                <div className="sc-detail-ex-name">{ex.exercise.name}</div>
                <div className="sc-detail-ex-mg">{formatMuscles(ex.exercise)}</div>
              </div>
              {ex.exercise.isMainLift && e > 0 && (
                <div className="sc-detail-ex-e1rm">
                  <span className="sc-detail-ex-e1rm-label">e1RM</span>
                  <span className="sc-detail-ex-e1rm-val">{Math.round(e)}kg</span>
                </div>
              )}
            </div>
            {completed.map((s, si) => (
              <div key={s.id} className="sc-detail-set-row">
                <div className="sc-detail-set-num">SET {si + 1}</div>
                <div className="sc-detail-set-w">
                  {s.weight}<span className="sc-detail-set-w-unit">kg</span>
                </div>
                <div className="sc-detail-set-r">
                  × {s.reps}<span className="sc-detail-set-r-unit">reps</span>
                </div>
                <div className="sc-detail-set-rpe">@{s.rpe}</div>
                <div className="sc-detail-set-vol">
                  <span className="sc-detail-set-vol-val">{s.weight * s.reps}</span> kg vol
                </div>
              </div>
            ))}
            <div className="sc-detail-ex-foot">
              <span>{completed.length} sets</span>
              <span className="sc-detail-ex-foot-spacer">
                Total <span className="sc-detail-ex-foot-val">{totalVol}</span> kg
              </span>
            </div>
          </div>
        );
      })}
      {session.note && <div className="sc-detail-note">{session.note}</div>}
    </div>
  );
}

function SessionCard({ hs, expanded, onToggle }: {
  hs: HistSession;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { session, stats } = hs;
  const d = new Date(session.startTime);
  const dow = DOW_SHORT[(d.getDay() + 6) % 7].toUpperCase();
  const mon = MONTH_SHORT[d.getMonth()].toUpperCase();
  const primary = hs.mainLifts[0];

  const cardCls = [
    'sc',
    hs.prs.length ? 'is-pr' : '',
    hs.fatigued ? 'is-fatigue' : '',
    hs.deload ? 'is-deload' : '',
    expanded ? 'is-expanded' : '',
  ].filter(Boolean).join(' ');

  // RPE spark bars across every completed set, hardest sets flagged.
  const sparkSets = session.exercises
    .flatMap((ex) => ex.sets.filter((s) => s.completed))
    .slice(0, 14);

  const hasTags = hs.prs.length > 0 || hs.fatigued || hs.deload;
  const r = session.readiness;

  return (
    <div className={cardCls}>
      <button type="button" className="sc-head" onClick={onToggle}>
        <div className="sc-rail">
          <div className="sc-rail-dow">{dow}</div>
          <div className="sc-rail-day">{d.getDate()}</div>
          <div className="sc-rail-month">{mon}</div>
        </div>
        <div className="sc-body">
          <div className="sc-eyebrow">
            {hs.phase && <span className="sc-eye-phase">{hs.phase}</span>}
            {hs.phase && hs.week && <span className="sc-eye-sep">·</span>}
            {hs.week && <span>{hs.week}</span>}
            {(hs.phase || hs.week) && <span className="sc-eye-sep">·</span>}
            <span className="sc-eye-time">{fmtTime(session.startTime)}</span>
          </div>
          <div className="sc-name">{hs.title}</div>
          {hasTags && (
            <div className="sc-tags">
              {hs.prs.map((lift) => (
                <span key={`pr-${lift}`} className="sc-tag is-pr">PR · {liftAbbrev(lift)}</span>
              ))}
              {hs.fatigued && <span className="sc-tag is-fatigue">Fatigued</span>}
              {hs.deload && <span className="sc-tag is-deload">Deload</span>}
            </div>
          )}
        </div>
        <div className="sc-expand">▾</div>
      </button>

      {primary && (
        <div className="sc-main-line">
          <span className="sc-main-tag">{liftTag(primary.exercise.name)}</span>
          <span className="sc-main-set">
            <span className="sc-main-set-w">{primary.top.weight}</span>
            <span className="sc-main-set-unit">kg</span>
            <span className="sc-main-set-x">×</span>
            <span className="sc-main-set-r">{primary.top.reps}</span>
            <span className="sc-main-set-rpe">@{primary.top.rpe}</span>
          </span>
          <span className="sc-main-e1rm">
            <span className="sc-main-e1rm-val">
              {Math.round(primary.e1rm)}<span className="sc-main-e1rm-unit">kg</span>
            </span>
            {hs.deltas[primary.exercise.name] !== undefined && (() => {
              const dlt = hs.deltas[primary.exercise.name];
              const cls = Math.abs(dlt) < 0.5 ? 'is-flat' : dlt > 0 ? 'is-up' : 'is-down';
              const arrow = dlt > 0.5 ? '↑' : dlt < -0.5 ? '↓' : '→';
              return (
                <span className={`sc-main-e1rm-delta ${cls}`}>
                  {arrow} {dlt >= 0 ? '+' : ''}{dlt.toFixed(1)}kg
                </span>
              );
            })()}
          </span>
        </div>
      )}

      <div className="sc-foot">
        <div className="sc-foot-cell">
          <div className="sc-foot-cell-val">
            {stats.durationMinutes ?? '—'}
            {stats.durationMinutes != null && <span className="sc-foot-cell-unit">min</span>}
          </div>
          <div className="sc-foot-cell-label">Time</div>
        </div>
        <div className="sc-foot-cell">
          <div className="sc-foot-cell-val">{stats.completedSets}</div>
          <div className="sc-foot-cell-label">Sets</div>
        </div>
        <div className="sc-foot-cell">
          <div className="sc-foot-cell-val">
            {stats.totalVolume >= 1000
              ? (stats.totalVolume / 1000).toFixed(1)
              : stats.totalVolume}
            <span className="sc-foot-cell-unit">{stats.totalVolume >= 1000 ? 't' : 'kg'}</span>
          </div>
          <div className="sc-foot-cell-label">Volume</div>
        </div>
        <div className="sc-foot-cell">
          <div className="sc-foot-cell-val">
            {stats.avgRpe != null ? stats.avgRpe.toFixed(1) : '—'}
            {stats.avgRpe != null && <span className="sc-foot-cell-unit">avg</span>}
          </div>
          <div className="sc-foot-cell-label">RPE</div>
        </div>
      </div>

      {(r || sparkSets.length > 0) && (
        <div className="sc-readiness">
          {r && (
            <>
              <ReadinessPip label="Sleep" value={`${r.sleep}h`} low={r.sleep < 6} />
              <ReadinessPip label="Energy" value={`${r.energy}/5`} low={r.energy <= 2} />
              <ReadinessPip label="Soreness" value={`${r.soreness}/5`} low={r.soreness >= 4} />
            </>
          )}
          <div className="sc-spark-strip">
            {sparkSets.map((s, i) => (
              <div
                key={i}
                className={`sc-spark-bar ${s.rpe >= 8.5 ? 'is-hard' : ''}`}
                style={{ height: Math.max(3, 4 + Math.round(((s.rpe - 6) / 4) * 14)) }}
              />
            ))}
          </div>
        </div>
      )}

      {expanded && <SessionDetail hs={hs} />}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function HistoryTab() {
  const { sessions } = useTrainingStore();
  const now = useMemo(() => Date.now(), []);

  const [range, setRange] = useState<RangeKey>('12W');
  const [calMode, setCalMode] = useState<CalMode>('month');
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [activeLift, setActiveLift] = useState<string | null>(null);
  const [phaseF, setPhaseF] = useState<string | null>(null);
  const [stateF, setStateF] = useState<StateFilter | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const model = useMemo(() => buildModel(sessions), [sessions]);

  // Calendar starts on the month of the most recent Session.
  const initialMonth = useMemo(() => {
    if (sessions.length === 0) return new Date(now);
    const latest = sessions.reduce((a, b) => (a.startTime > b.startTime ? a : b));
    const d = new Date(latest.startTime);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, [sessions, now]);
  const [monthDate, setMonthDate] = useState(initialMonth);
  // Week strip anchor — starts on the week of the most recent Session so the
  // strip shows real data the moment the lifter switches to Week mode.
  const [weekAnchor, setWeekAnchor] = useState(() => {
    if (sessions.length === 0) return weekStartTs(now);
    const latest = sessions.reduce((a, b) => (a.startTime > b.startTime ? a : b));
    return weekStartTs(latest.startTime);
  });

  // Per-day volume / PR rollup feeding the heatmap.
  const dayData = useMemo(() => {
    const m = new Map<number, DayCell>();
    for (const session of sessions) {
      const hs = model.get(session.id);
      if (!hs) continue;
      const k = dayKey(session.startTime);
      const cur = m.get(k) ?? { key: k, volume: 0, count: 0, hasPr: false };
      cur.volume += hs.stats.totalVolume;
      cur.count += 1;
      cur.hasPr = cur.hasPr || hs.prs.length > 0;
      m.set(k, cur);
    }
    return m;
  }, [sessions, model]);
  const maxVolume = useMemo(
    () => Math.max(1, ...[...dayData.values()].map((d) => d.volume)),
    [dayData],
  );
  const monthCount = useMemo(
    () =>
      sessions.filter((s) => {
        const d = new Date(s.startTime);
        return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
      }).length,
    [sessions, monthDate],
  );

  // Per-lift e1RM trend strip.
  const trends = useMemo<TrendModel[]>(() => {
    const chrono = [...sessions].sort((a, b) => a.startTime - b.startTime);
    const out: TrendModel[] = [];
    for (const name of MAIN_LIFTS) {
      const series: { ts: number; e: number }[] = [];
      for (const s of chrono) {
        const log = s.exercises.find((e) => e.exercise.name === name);
        if (!log) continue;
        const t = topSet(log.sets);
        if (!t) continue;
        series.push({ ts: s.startTime, e: e1rm(t.weight, t.reps, t.rpe) });
      }
      if (series.length === 0) continue;
      const latest = series[series.length - 1].e;
      const past = series.filter((p) => p.ts <= now - 28 * DAY_MS);
      const baseline = past.length ? past[past.length - 1].e : series[0].e;
      const best = series.reduce((mx, p) => Math.max(mx, p.e), 0);
      out.push({
        name,
        series: series.map((p) => p.e),
        latest,
        delta: latest - baseline,
        isPr: latest >= best - 0.01,
      });
    }
    return out;
  }, [sessions, now]);

  // Which filter chips have anything to match.
  const availablePhases = useMemo(() => {
    const set = new Set<string>();
    for (const hs of model.values()) if (hs.phase) set.add(hs.phase);
    return [...set];
  }, [model]);
  const stateCounts = useMemo(() => {
    let pr = 0;
    let fatigued = 0;
    let deload = 0;
    for (const hs of model.values()) {
      if (hs.prs.length) pr++;
      if (hs.fatigued) fatigued++;
      if (hs.deload) deload++;
    }
    return { PR: pr, Fatigued: fatigued, Deload: deload };
  }, [model]);

  // Header stats over the selected range (independent of the list filters).
  const headerStats = useMemo(() => {
    const cutoff = now - RANGE_DAYS[range] * DAY_MS;
    let count = 0;
    let volume = 0;
    let minutes = 0;
    let prs = 0;
    for (const hs of model.values()) {
      if (hs.session.startTime < cutoff) continue;
      count++;
      volume += hs.stats.totalVolume;
      minutes += hs.stats.durationMinutes ?? 0;
      prs += hs.prs.length;
    }
    return {
      sessions: count,
      volumeT: (volume / 1000).toFixed(1),
      hours: (minutes / 60).toFixed(1),
      prs,
    };
  }, [model, range, now]);

  // The filtered, newest-first session feed.
  const filtered = useMemo(() => {
    const cutoff = now - RANGE_DAYS[range] * DAY_MS;
    let list = [...model.values()]
      .filter((hs) => hs.session.startTime >= cutoff)
      .sort((a, b) => b.session.startTime - a.session.startTime);
    if (selectedKey) list = list.filter((hs) => dayKey(hs.session.startTime) === selectedKey);
    if (phaseF) list = list.filter((hs) => hs.phase === phaseF);
    if (stateF === 'PR') list = list.filter((hs) => hs.prs.length > 0);
    if (stateF === 'Fatigued') list = list.filter((hs) => hs.fatigued);
    if (stateF === 'Deload') list = list.filter((hs) => hs.deload);
    if (activeLift) {
      list = list.filter((hs) =>
        hs.session.exercises.some((ex) => ex.exercise.name === activeLift),
      );
    }
    return list;
  }, [model, range, selectedKey, phaseF, stateF, activeLift, now]);

  // Group the feed into Monday-anchored weeks.
  const groups = useMemo(() => {
    const map = new Map<number, HistSession[]>();
    for (const hs of filtered) {
      const ws = weekStartTs(hs.session.startTime);
      const bucket = map.get(ws);
      if (bucket) bucket.push(hs);
      else map.set(ws, [hs]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([ws, items]) => ({
        weekStart: ws,
        items,
        label: items[0].week ?? fmtWeekRange(ws),
        phase: items[0].phase,
        totalVol: items.reduce((a, hs) => a + hs.stats.totalVolume, 0),
      }));
  }, [filtered]);

  const selectKey = (k: number) => {
    setSelectedKey((cur) => (cur === k ? null : k));
    setWeekAnchor(weekStartTs(dateFromKey(k).getTime()));
  };
  // Calendar nav steps by month in Month mode, by week in Week mode.
  const goPrev = () => {
    if (calMode === 'week') setWeekAnchor((w) => shiftWeek(w, -1));
    else setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (calMode === 'week') setWeekAnchor((w) => shiftWeek(w, 1));
    else setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const selectedDate = selectedKey ? dateFromKey(selectedKey) : null;
  const hasActiveFilter = !!(selectedKey || phaseF || stateF || activeLift);

  return (
    <div className="hist">
      {/* ── Header ── */}
      <div className="hist-head">
        <div className="hist-head-top">
          <div>
            <div className="hist-head-eyebrow">Lift Buddy · History</div>
            <div className="hist-head-title">Training log</div>
          </div>
          <div className="hist-range">
            {(['1W', '4W', '12W'] as RangeKey[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`hist-range-btn ${range === r ? 'is-active' : ''}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="hist-stats">
          <div className="hist-stat">
            <div className="hist-stat-val tabular">{headerStats.sessions}</div>
            <div className="hist-stat-label">Sessions</div>
          </div>
          <div className="hist-stat">
            <div className="hist-stat-val tabular">
              {headerStats.volumeT}<span className="hist-stat-unit">t</span>
            </div>
            <div className="hist-stat-label">Volume</div>
          </div>
          <div className="hist-stat">
            <div className="hist-stat-val tabular">
              {headerStats.hours}<span className="hist-stat-unit">h</span>
            </div>
            <div className="hist-stat-label">Time</div>
          </div>
          <div className="hist-stat">
            <div className="hist-stat-val tabular">{headerStats.prs}</div>
            <div className="hist-stat-label">PRs</div>
          </div>
        </div>
      </div>

      {/* ── Trend strip ── */}
      {trends.length > 0 && (
        <div className="trend-strip">
          {trends.map((trend) => (
            <TrendCard
              key={trend.name}
              trend={trend}
              active={activeLift === trend.name}
              onClick={() =>
                setActiveLift((cur) => (cur === trend.name ? null : trend.name))
              }
            />
          ))}
        </div>
      )}

      {/* ── Calendar heatmap ── */}
      <CalendarHeatmap
        monthDate={monthDate}
        weekAnchor={weekAnchor}
        dayData={dayData}
        maxVolume={maxVolume}
        monthCount={monthCount}
        selectedKey={selectedKey}
        mode={calMode}
        now={now}
        onPrev={goPrev}
        onNext={goNext}
        onMode={setCalMode}
        onSelect={selectKey}
      />

      {/* ── Filter chips ── */}
      <div className="hist-filters-wrap">
        <div className="hist-filters">
          <button
            type="button"
            className={`fchip ${!phaseF && !stateF ? 'is-active' : ''}`}
            onClick={() => { setPhaseF(null); setStateF(null); }}
          >
            All
          </button>
          {(['PR', 'Fatigued', 'Deload'] as StateFilter[]).some((s) => stateCounts[s] > 0) && (
            <span className="fchip-section-rule" />
          )}
          {(['PR', 'Fatigued', 'Deload'] as StateFilter[])
            .filter((s) => stateCounts[s] > 0)
            .map((s) => (
              <button
                key={s}
                type="button"
                className={`fchip ${stateF === s ? 'is-active' : ''}`}
                onClick={() => setStateF((cur) => (cur === s ? null : s))}
              >
                {(s === 'PR' || s === 'Fatigued') && <span className="fchip-dot" />}
                {s === 'PR' ? 'PRs' : s}
              </button>
            ))}
          {availablePhases.length > 0 && <span className="fchip-section-rule" />}
          {availablePhases.map((p) => (
            <button
              key={p}
              type="button"
              className={`fchip ${phaseF === p ? 'is-active' : ''}`}
              onClick={() => setPhaseF((cur) => (cur === p ? null : p))}
            >
              {PHASE_ABBREV[p] ?? p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Active filter pills ── */}
      {hasActiveFilter && (
        <div className="hist-active-row">
          {selectedDate && (
            <span className="hist-active-pill">
              {selectedDate.toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short',
              })}
              <button
                type="button"
                className="hist-active-pill-x"
                onClick={() => setSelectedKey(null)}
                aria-label="Clear day filter"
              >
                ×
              </button>
            </span>
          )}
          {activeLift && (
            <span className="hist-active-pill">
              Lift: {liftAbbrev(activeLift)}
              <button
                type="button"
                className="hist-active-pill-x"
                onClick={() => setActiveLift(null)}
                aria-label="Clear lift filter"
              >
                ×
              </button>
            </span>
          )}
          <span className="hist-active-count">{filtered.length} matches</span>
        </div>
      )}

      {/* ── Session list ── */}
      <div className="sess-section">
        <div className="sess-section-eyebrow">Sessions</div>
        <div className="sess-section-count">
          {filtered.length === sessions.length
            ? `${filtered.length} total`
            : `${filtered.length} of ${sessions.length}`}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="sess-empty">
          {sessions.length === 0
            ? 'No sessions yet. Start training!'
            : 'No sessions match these filters.'}
        </div>
      ) : (
        <div className="sess-list">
          {groups.map((group) => (
            <div key={group.weekStart} className="sess-group">
              <div className="sess-week-div">
                <span className="sess-week-div-label">{group.label}</span>
                {group.phase && <span className="sess-week-div-phase">{group.phase}</span>}
                <span className="sess-week-div-line" />
                <span className="sess-week-div-stat">
                  <span className="sess-week-div-stat-val">{group.items.length}</span> sess
                  <span className="sess-week-div-stat-sep">·</span>
                  <span className="sess-week-div-stat-val">
                    {(group.totalVol / 1000).toFixed(1)}t
                  </span>
                </span>
              </div>
              {group.items.map((hs) => (
                <div key={hs.session.id} className="sess-group-card">
                  <SessionCard
                    hs={hs}
                    expanded={expandedId === hs.session.id}
                    onToggle={() =>
                      setExpandedId((cur) => (cur === hs.session.id ? null : hs.session.id))
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
