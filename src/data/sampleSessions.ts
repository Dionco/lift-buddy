import { Session, SetLog, ExerciseLog, Exercise, ReadinessCheckIn } from '@/types/training';
import { EXERCISES } from './sampleProgram';

// Programmatic generator for ~12 weeks of training history. The shape exists
// so the Progress tab has enough data to draw real e1RM trends, fill weekly
// volume bars across every muscle group, and show a fatigue signal on the
// trailing weeks. All timestamps are relative to "now" so the dataset stays
// fresh on every load.

type SetSpec = { weight: number; reps: number; rpe: number };
type LiftSpec = { exercise: Exercise; sets: SetSpec[] };

const dayMs = 86_400_000;

function makeSet(spec: SetSpec, baseTs: number, idx: number): SetLog {
  return {
    id: `s-${baseTs}-${idx}`,
    weight: spec.weight,
    reps: spec.reps,
    rpe: spec.rpe,
    timestamp: baseTs + idx * 90_000,
    completed: true,
  };
}

function makeExerciseLog(spec: LiftSpec, baseTs: number, exerciseIdx: number): ExerciseLog {
  return {
    exercise: spec.exercise,
    sets: spec.sets.map((s, i) => makeSet(s, baseTs + exerciseIdx * 600_000, i)),
  };
}

// Working-set patterns. Each returns a list of sets given a top-set load and
// a target RPE for the heaviest set, so we can scale loads weekly.

function topSet(weight: number, reps: number, sets: number, topRpe: number, rpeRamp = 0.5): SetSpec[] {
  // First set at topRpe - rpeRamp, last at topRpe.
  return Array.from({ length: sets }, (_, i) => {
    const rpe = +(topRpe - rpeRamp + (rpeRamp * i) / Math.max(1, sets - 1)).toFixed(1);
    return { weight, reps, rpe };
  });
}

function backoff(weight: number, reps: number, sets: number, rpe: number): SetSpec[] {
  return Array.from({ length: sets }, () => ({ weight, reps, rpe }));
}

interface WeekParams {
  squat: number;     // top working weight
  bench: number;
  deadlift: number;
  ohp: number;
  row: number;
  // accessory loads roughly track the main lifts
  rdl: number;
  legPress: number;
  inclineBench: number;
  pausedSquat: number;
  // RPE adjustment for the week (a small bump to model accumulating fatigue)
  rpeAdjust: number;
}

// Day templates — each takes the day's timestamp and the week's loads.

function squatDay(ts: number, w: WeekParams): ExerciseLog[] {
  return [
    { exercise: EXERCISES.squat, sets: topSet(w.squat, 5, 4, 8 + w.rpeAdjust, 1) },
    { exercise: EXERCISES.legPress, sets: backoff(w.legPress, 10, 3, 7.5 + w.rpeAdjust) },
    { exercise: EXERCISES.legCurl, sets: backoff(Math.round(w.squat * 0.35), 10, 3, 7.5) },
    { exercise: EXERCISES.calfRaise, sets: backoff(Math.round(w.squat * 0.4), 12, 3, 7) },
  ].map((spec, i) => makeExerciseLog(spec, ts, i));
}

function benchDay(ts: number, w: WeekParams): ExerciseLog[] {
  return [
    { exercise: EXERCISES.bench, sets: topSet(w.bench, 5, 4, 8 + w.rpeAdjust, 1) },
    { exercise: EXERCISES.overheadPress, sets: backoff(w.ohp, 8, 3, 7.5 + w.rpeAdjust) },
    { exercise: EXERCISES.dips, sets: backoff(0, 10, 3, 7.5) },
    { exercise: EXERCISES.lateralRaise, sets: backoff(Math.round(w.ohp * 0.3), 12, 4, 7.5) },
    { exercise: EXERCISES.bicepCurl, sets: backoff(Math.round(w.bench * 0.3), 10, 3, 7.5) },
  ].map((spec, i) => makeExerciseLog(spec, ts, i));
}

function deadliftDay(ts: number, w: WeekParams): ExerciseLog[] {
  return [
    { exercise: EXERCISES.deadlift, sets: topSet(w.deadlift, 3, 3, 8.5 + w.rpeAdjust, 1) },
    { exercise: EXERCISES.barbellRow, sets: topSet(w.row, 8, 4, 8 + w.rpeAdjust, 0.5) },
    { exercise: EXERCISES.pullUp, sets: backoff(0, 8, 3, 8) },
    { exercise: EXERCISES.rdl, sets: backoff(w.rdl, 8, 3, 7.5 + w.rpeAdjust) },
  ].map((spec, i) => makeExerciseLog(spec, ts, i));
}

function volumeDay(ts: number, w: WeekParams): ExerciseLog[] {
  return [
    { exercise: EXERCISES.pausedSquat, sets: topSet(w.pausedSquat, 5, 3, 8, 0.5) },
    { exercise: EXERCISES.inclineBench, sets: topSet(w.inclineBench, 8, 3, 7.5, 0.5) },
    { exercise: EXERCISES.lateralRaise, sets: backoff(Math.round(w.ohp * 0.25), 15, 3, 7) },
    { exercise: EXERCISES.bicepCurl, sets: backoff(Math.round(w.bench * 0.28), 12, 3, 7) },
    { exercise: EXERCISES.calfRaise, sets: backoff(Math.round(w.squat * 0.4), 15, 3, 7) },
  ].map((spec, i) => makeExerciseLog(spec, ts, i));
}

// Week-by-week loading scheme. Mostly progressive with a deload at week 5,
// a plateau at week 9, and a mild fatigue signal in the last 2 weeks (RPE
// drift on the same/lower load) so the Progress tab's fatigue indicator fires.

function weekParams(weekIdx: number): WeekParams {
  // Base linear progression: ~1.5% / week.
  const baseSquat = 100 + weekIdx * 1.75;
  const baseBench = 75 + weekIdx * 1.0;
  const baseDeadlift = 140 + weekIdx * 2.0;
  const baseOhp = 45 + weekIdx * 0.6;
  const baseRow = 70 + weekIdx * 0.9;

  // Deload at week 5: 80% loads, low RPE.
  if (weekIdx === 4) {
    return {
      squat: Math.round(baseSquat * 0.8),
      bench: Math.round(baseBench * 0.8 * 2) / 2,
      deadlift: Math.round(baseDeadlift * 0.8),
      ohp: Math.round(baseOhp * 0.8 * 2) / 2,
      row: Math.round(baseRow * 0.8 * 2) / 2,
      rdl: Math.round(baseDeadlift * 0.55),
      legPress: Math.round(baseSquat * 1.15),
      inclineBench: Math.round(baseBench * 0.7 * 2) / 2,
      pausedSquat: Math.round(baseSquat * 0.7),
      rpeAdjust: -1.5,
    };
  }

  // Late-block plateau: weeks 8-11 stay at week-7 loads, but RPE drifts up
  // across weeks 9-11 — this is what the fatigue signal looks for (declining
  // e1RM at the same load, or RPE drift on identical work).
  const inLatePlateau = weekIdx >= 8;
  const w = inLatePlateau ? 7 : weekIdx;
  const fatigueBump = inLatePlateau && weekIdx >= 9 ? (weekIdx - 8) * 0.5 : 0;

  return {
    squat: Math.round((100 + w * 1.75) * 2) / 2,
    bench: Math.round((75 + w * 1.0) * 2) / 2,
    deadlift: Math.round((140 + w * 2.0) * 2) / 2,
    ohp: Math.round((45 + w * 0.6) * 2) / 2,
    row: Math.round((70 + w * 0.9) * 2) / 2,
    rdl: Math.round((90 + w * 1.5) * 2) / 2,
    legPress: Math.round((140 + w * 2.5) * 2) / 2,
    inclineBench: Math.round((55 + w * 0.6) * 2) / 2,
    pausedSquat: Math.round((85 + w * 1.5) * 2) / 2,
    rpeAdjust: fatigueBump,
  };
}

function readiness(weekIdx: number, dayInWeek: number): ReadinessCheckIn {
  // Readiness loosely tracks fatigue; deload week is best, late-block weeks dip.
  if (weekIdx === 4) return { sleep: 8.5, energy: 5, soreness: 1 };
  if (weekIdx >= 10) {
    return {
      sleep: dayInWeek === 0 ? 6.5 : 6,
      energy: 3,
      soreness: 4,
    };
  }
  return {
    sleep: 7.5 - (dayInWeek === 2 ? 0.5 : 0),
    energy: 4,
    soreness: 2 + (dayInWeek === 2 ? 1 : 0),
  };
}

function weekName(blockIdx: number, weekInBlock: number): string {
  const blocks = ['Accumulation', 'Intensification', 'Realization'];
  return `${blocks[blockIdx]} · Week ${weekInBlock + 1}`;
}

// Generate 12 weeks of sessions, 4 days each (Mon, Tue, Thu, Sat — local
// weekday alignment is approximate; we step back 86_400_000 per day).

interface DayPlan {
  offsetDays: number;
  template: (ts: number, w: WeekParams) => ExerciseLog[];
  label: string;
}

const DAY_PLAN: DayPlan[] = [
  { offsetDays: 0, template: squatDay, label: 'Day 1 — Squat' },
  { offsetDays: 1, template: benchDay, label: 'Day 2 — Bench' },
  { offsetDays: 3, template: deadliftDay, label: 'Day 3 — Deadlift' },
  { offsetDays: 5, template: volumeDay, label: 'Day 4 — Volume' },
];

const TOTAL_WEEKS = 12;

function generateSessions(): Session[] {
  const now = Date.now();
  // Anchor: most recent session = yesterday-ish; oldest = ~12 weeks ago.
  // weekIdx 0 is the FIRST week (oldest); TOTAL_WEEKS-1 is the most recent.
  const sessions: Session[] = [];
  for (let weekIdx = 0; weekIdx < TOTAL_WEEKS; weekIdx++) {
    const w = weekParams(weekIdx);
    // Days back from "now" — most recent week is small, oldest is large.
    const weeksAgo = TOTAL_WEEKS - 1 - weekIdx;
    for (let dayIdx = 0; dayIdx < DAY_PLAN.length; dayIdx++) {
      const plan = DAY_PLAN[dayIdx];
      // Layout: each week starts on Monday-equivalent → offsetDays inside the week.
      // daysAgo = weeksAgo*7 + (6 - offsetDays) so day 1 (offset 0) is the start of the week.
      const daysAgo = weeksAgo * 7 + (6 - plan.offsetDays);
      const startTime = now - daysAgo * dayMs + 9 * 3_600_000; // 09:00 local-ish
      const endTime = startTime + 75 * 60_000; // ~75-minute session

      const block = weekIdx < 4 ? 0 : weekIdx < 8 ? 1 : 2;
      const weekInBlock = weekIdx < 4 ? weekIdx : weekIdx < 8 ? weekIdx - 4 : weekIdx - 8;

      sessions.push({
        id: `gen-w${weekIdx}-d${dayIdx}`,
        startTime,
        endTime,
        workoutName: `${weekName(block, weekInBlock)} · ${plan.label}`,
        readiness: readiness(weekIdx, dayIdx),
        exercises: plan.template(startTime, w),
      });
    }
  }
  // Chronological order, oldest first.
  return sessions.sort((a, b) => a.startTime - b.startTime);
}

export const sampleSessions: Session[] = generateSessions();
