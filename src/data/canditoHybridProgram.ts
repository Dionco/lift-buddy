import { Program, ProgramBlock, ProgramDay, ProgramExercise } from '@/types/training';
import { EXERCISES } from './exerciseLibrary';

/**
 * Candito-Hybrid 6-week powerlifting block.
 *
 * Squat & Deadlift programming follows the Candito 6-Week template
 * (`docs/candito_program_explained.md`): hypertrophy → MR10 → linear max OT →
 * heavy acclimation → rep-max test → taper + test.
 *
 * Bench programming follows the 4-day bench specialization from
 * `docs/bench_press_programming_summary.md`:
 *   Day 1 (Mon)  — Wide-grip heavy triples 80-90% + DB bench volume
 *   Day 2 (Tue)  — Close-grip volume 65-75% + triceps & shoulder accessories
 *   Day 3 (Thu)  — 2ct pause singles 88-92% + comp bench volume 60-75%
 *   Day 4 (Sat)  — Progressive heavy comp single 90-97% + bodybuilding accessories
 *
 * All `loadPercentage` values are % of the lifter's user-entered 1RM for the
 * exercise's main-lift basis. RPE-only entries (rpeTarget without
 * loadPercentage) are autoregulated — the lifter picks the load.
 *
 * Schedule: 5 sessions/week (Mon · Tue · Thu · Fri · Sat). Wed & Sun rest.
 */

const pe = (
  exercise: ProgramExercise['exercise'],
  prescription: ProgramExercise['prescription'],
): ProgramExercise => ({ exercise, prescription });

// ─── WEEK 1 ─ Hypertrophy (moderate) ─────────────────────────────────────
const w1: ProgramDay[] = [
  {
    id: 'ch-w1-d1', name: 'Day 1 — Heavy Lower + Bench D1',
    exercises: [
      pe(EXERCISES.squat,         { sets: 4, reps: '6', loadPercentage: 80 }),
      pe(EXERCISES.deadlift,      { sets: 2, reps: '6', loadPercentage: 80 }),
      pe(EXERCISES.wideGripBench, { sets: 4, reps: '3', loadPercentage: 80 }),
      pe(EXERCISES.dbBench,       { sets: 3, reps: '10-15', rpeTarget: 9, notes: 'Last set RPE 10' }),
    ],
  },
  {
    id: 'ch-w1-d2', name: 'Day 2 — Bench Volume (Close Grip)',
    exercises: [
      pe(EXERCISES.closeGripBench, { sets: 4, reps: '5', loadPercentage: 67 }),
      pe(EXERCISES.ohcTricepsExt,  { sets: 3, reps: '8-12', rpeTarget: 9, notes: 'Sets 1-2 RPE 8-9, set 3 to failure' }),
      pe(EXERCISES.dbSeatedOhp,    { sets: 3, reps: '8-12', rpeTarget: 9, notes: 'Sets 1-2 RPE 8-9, set 3 to failure' }),
    ],
  },
  {
    id: 'ch-w1-d3', name: 'Day 3 — Pause Bench + Comp Volume',
    exercises: [
      pe(EXERCISES.pausedBench, { sets: 3, reps: '1',  loadPercentage: 88, notes: '2ct pause — focus on technique, do not chase weight' }),
      pe(EXERCISES.bench,       { sets: 4, reps: '6',  loadPercentage: 65 }),
    ],
  },
  {
    id: 'ch-w1-d4', name: 'Day 4 — Volume Lower',
    exercises: [
      pe(EXERCISES.squat,         { sets: 4, reps: '8', loadPercentage: 71 }),
      pe(EXERCISES.pausedDeadlift,{ sets: 3, reps: '6', loadPercentage: 65 }),
    ],
  },
  {
    id: 'ch-w1-d5', name: 'Day 5 — Bench Heavy Single + Accessories',
    exercises: [
      pe(EXERCISES.bench,           { sets: 1, reps: '1', loadPercentage: 90, notes: 'Leave 2-3 in tank — week 1 acclimation' }),
      pe(EXERCISES.bench,           { sets: 3, reps: '5', loadPercentage: 75, notes: 'Back-off after heavy single' }),
      pe(EXERCISES.dbInclineBench,  { sets: 3, reps: '10-12', rpeTarget: 9 }),
      pe(EXERCISES.skullCrushers,   { sets: 3, reps: '8-12', rpeTarget: 9 }),
      pe(EXERCISES.lateralRaise,    { sets: 3, reps: '12-15', rpeTarget: 9 }),
    ],
  },
];

// ─── WEEK 2 ─ Hypertrophy (higher — MR10 + back-off) ─────────────────────
const MR_BACKOFF_NOTE =
  'MR10: max reps to RPE 10. Back-off: 10 reps→10×3 / 8-9→8×3 / 7→5×3 / <7→skip, drop 1RM 2.5%. 60s rest.';
const w2: ProgramDay[] = [
  {
    id: 'ch-w2-d1', name: 'Day 1 — Squat MR10 + DL MR10',
    exercises: [
      pe(EXERCISES.squat,         { sets: 1, reps: 'MR', loadPercentage: 80, notes: MR_BACKOFF_NOTE }),
      pe(EXERCISES.squat,         { sets: 5, reps: '3',  loadPercentage: 80, notes: 'Back-off — adjust sets per MR result' }),
      pe(EXERCISES.deadlift,      { sets: 1, reps: 'MR', loadPercentage: 80, notes: 'MR10 — no back-off on DL' }),
      pe(EXERCISES.wideGripBench, { sets: 4, reps: '3',  loadPercentage: 82.5 }),
      pe(EXERCISES.dbBench,       { sets: 3, reps: '10-12', rpeTarget: 9 }),
    ],
  },
  {
    id: 'ch-w2-d2', name: 'Day 2 — Bench Volume (Close Grip)',
    exercises: [
      pe(EXERCISES.closeGripBench, { sets: 4, reps: '5', loadPercentage: 70 }),
      pe(EXERCISES.ohcTricepsExt,  { sets: 3, reps: '8-12', rpeTarget: 9, notes: 'Sets 1-2 RPE 8-9, set 3 to failure' }),
      pe(EXERCISES.dbSeatedOhp,    { sets: 3, reps: '8-12', rpeTarget: 9, notes: 'Sets 1-2 RPE 8-9, set 3 to failure' }),
    ],
  },
  {
    id: 'ch-w2-d3', name: 'Day 3 — Pause Bench + Comp Volume',
    exercises: [
      pe(EXERCISES.pausedBench, { sets: 3, reps: '1', loadPercentage: 90 }),
      pe(EXERCISES.bench,       { sets: 4, reps: '6', loadPercentage: 67.5 }),
    ],
  },
  {
    id: 'ch-w2-d4', name: 'Day 4 — Squat MR10 + Pause DL',
    exercises: [
      pe(EXERCISES.squat,          { sets: 1, reps: 'MR', loadPercentage: 81, notes: MR_BACKOFF_NOTE }),
      pe(EXERCISES.squat,          { sets: 5, reps: '3',  loadPercentage: 81, notes: 'Back-off — adjust sets per MR result' }),
      pe(EXERCISES.pausedDeadlift, { sets: 3, reps: '6',  loadPercentage: 67.5 }),
    ],
  },
  {
    id: 'ch-w2-d5', name: 'Day 5 — Bench Heavy Single + Accessories',
    exercises: [
      pe(EXERCISES.bench,          { sets: 1, reps: '1', loadPercentage: 92.5 }),
      pe(EXERCISES.bench,          { sets: 3, reps: '5', loadPercentage: 77.5 }),
      pe(EXERCISES.dbInclineBench, { sets: 3, reps: '10-12', rpeTarget: 9 }),
      pe(EXERCISES.skullCrushers,  { sets: 3, reps: '8-12', rpeTarget: 9 }),
      pe(EXERCISES.lateralRaise,   { sets: 3, reps: '12-15', rpeTarget: 9 }),
    ],
  },
];

// ─── WEEK 3 ─ Linear Max OT (Intensification) ────────────────────────────
const w3: ProgramDay[] = [
  {
    id: 'ch-w3-d1', name: 'Day 1 — Heavy Squat + DL + Bench D1',
    exercises: [
      pe(EXERCISES.squat,         { sets: 3, reps: '4-6', loadPercentage: 87, rpeTarget: 9 }),
      pe(EXERCISES.deadlift,      { sets: 3, reps: '3-6', loadPercentage: 88, rpeTarget: 9 }),
      pe(EXERCISES.wideGripBench, { sets: 4, reps: '3',   loadPercentage: 85 }),
    ],
  },
  {
    id: 'ch-w3-d2', name: 'Day 2 — Bench Volume (Close Grip)',
    exercises: [
      pe(EXERCISES.closeGripBench, { sets: 3, reps: '5', loadPercentage: 72.5 }),
      pe(EXERCISES.ohcTricepsExt,  { sets: 3, reps: '8-12', rpeTarget: 9 }),
      pe(EXERCISES.dbSeatedOhp,    { sets: 3, reps: '8-12', rpeTarget: 9 }),
    ],
  },
  {
    id: 'ch-w3-d3', name: 'Day 3 — Pause Bench + Comp Volume',
    exercises: [
      pe(EXERCISES.pausedBench, { sets: 3, reps: '1', loadPercentage: 91 }),
      pe(EXERCISES.bench,       { sets: 3, reps: '5', loadPercentage: 72.5 }),
    ],
  },
  {
    id: 'ch-w3-d4', name: 'Day 4 — Volume Lower',
    exercises: [
      pe(EXERCISES.squat,          { sets: 1, reps: '4-6', loadPercentage: 88, rpeTarget: 9 }),
      pe(EXERCISES.pausedDeadlift, { sets: 2, reps: '5',   loadPercentage: 72.5 }),
    ],
  },
  {
    id: 'ch-w3-d5', name: 'Day 5 — Bench Heavy Single + Accessories',
    exercises: [
      pe(EXERCISES.bench,          { sets: 1, reps: '1', loadPercentage: 95 }),
      pe(EXERCISES.bench,          { sets: 3, reps: '3', loadPercentage: 80 }),
      pe(EXERCISES.dbInclineBench, { sets: 3, reps: '10', rpeTarget: 9 }),
      pe(EXERCISES.skullCrushers,  { sets: 3, reps: '8-10', rpeTarget: 9 }),
      pe(EXERCISES.lateralRaise,   { sets: 3, reps: '12', rpeTarget: 9 }),
    ],
  },
];

// ─── WEEK 4 ─ Heavy Acclimation ──────────────────────────────────────────
// Ascending squat triples are modelled as three single-set ProgramExercise
// entries with stepping percentages, so each load shows independently in the
// docket and ActiveWorkout.
const w4: ProgramDay[] = [
  {
    id: 'ch-w4-d1', name: 'Day 1 — Ascending Squat + Heavy DL + Bench D1',
    exercises: [
      pe(EXERCISES.squat,         { sets: 1, reps: '3', loadPercentage: 88, notes: 'Ascending triple 1/3' }),
      pe(EXERCISES.squat,         { sets: 1, reps: '3', loadPercentage: 90, notes: 'Ascending triple 2/3' }),
      pe(EXERCISES.squat,         { sets: 1, reps: '3', loadPercentage: 92, notes: 'Ascending triple 3/3 — RPE 9 cap' }),
      pe(EXERCISES.deadlift,      { sets: 2, reps: '2', loadPercentage: 90 }),
      pe(EXERCISES.wideGripBench, { sets: 6, reps: '3', loadPercentage: 85 }),
    ],
  },
  {
    id: 'ch-w4-d2', name: 'Day 2 — Bench Volume (Close Grip)',
    exercises: [
      pe(EXERCISES.closeGripBench, { sets: 3, reps: '5', loadPercentage: 72.5 }),
      pe(EXERCISES.ohcTricepsExt,  { sets: 3, reps: '8-10', rpeTarget: 9 }),
      pe(EXERCISES.dbSeatedOhp,    { sets: 3, reps: '8-10', rpeTarget: 9 }),
    ],
  },
  {
    id: 'ch-w4-d3', name: 'Day 3 — Pause Bench + Comp Volume',
    exercises: [
      pe(EXERCISES.pausedBench, { sets: 3, reps: '1', loadPercentage: 92 }),
      pe(EXERCISES.bench,       { sets: 3, reps: '3', loadPercentage: 80 }),
    ],
  },
  {
    id: 'ch-w4-d4', name: 'Day 4 — Volume Lower (Heavy Doubles)',
    exercises: [
      pe(EXERCISES.squat,          { sets: 2, reps: '2', loadPercentage: 90 }),
      pe(EXERCISES.pausedDeadlift, { sets: 1, reps: '3', loadPercentage: 80 }),
    ],
  },
  {
    id: 'ch-w4-d5', name: 'Day 5 — Bench Heavy Single + Accessories',
    exercises: [
      pe(EXERCISES.bench,          { sets: 1, reps: '1', loadPercentage: 97 }),
      pe(EXERCISES.bench,          { sets: 5, reps: '3', loadPercentage: 85 }),
      pe(EXERCISES.dbInclineBench, { sets: 3, reps: '8',  rpeTarget: 9 }),
      pe(EXERCISES.skullCrushers,  { sets: 3, reps: '8',  rpeTarget: 9 }),
      pe(EXERCISES.lateralRaise,   { sets: 3, reps: '12', rpeTarget: 9 }),
    ],
  },
];

// ─── WEEK 5 ─ Rep Max Test (Realization) ─────────────────────────────────
// AMRAP sets are `reps: 'MR'` — the lifter goes to RPE 10. Use the projection
// chart in `docs/candito_program_explained.md` to derive new 1RMs after the
// week. Tuesday is intentionally light; Friday is rest.
const w5: ProgramDay[] = [
  {
    id: 'ch-w5-d1', name: 'Day 1 — Squat MR Test',
    exercises: [
      pe(EXERCISES.squat,          { sets: 1, reps: 'MR', loadPercentage: 95, notes: 'AMRAP @ RPE 10. Project new 1RM from reps × multiplier (see docs).' }),
      pe(EXERCISES.pausedDeadlift, { sets: 2, reps: '3',  loadPercentage: 80, notes: 'Light — save back for Thursday DL test' }),
      pe(EXERCISES.wideGripBench,  { sets: 3, reps: '3',  loadPercentage: 80, notes: 'Easy bench — no PR attempts here' }),
    ],
  },
  {
    id: 'ch-w5-d2', name: 'Day 2 — Bench Volume (Light)',
    exercises: [
      pe(EXERCISES.closeGripBench, { sets: 3, reps: '5', loadPercentage: 67 }),
      pe(EXERCISES.ohcTricepsExt,  { sets: 2, reps: '10', rpeTarget: 8 }),
      pe(EXERCISES.dbSeatedOhp,    { sets: 2, reps: '10', rpeTarget: 8 }),
    ],
  },
  {
    id: 'ch-w5-d3', name: 'Day 3 — Deadlift MR Test',
    exercises: [
      pe(EXERCISES.deadlift, { sets: 1, reps: 'MR', loadPercentage: 95, notes: 'AMRAP @ RPE 10. Project new 1RM from reps × multiplier.' }),
    ],
  },
  {
    id: 'ch-w5-d4', name: 'Day 4 — Rest (optional light accessories)',
    exercises: [
      pe(EXERCISES.ohcTricepsExt, { sets: 2, reps: '12', rpeTarget: 7, notes: 'Optional — skip if recovery is low' }),
      pe(EXERCISES.lateralRaise,  { sets: 2, reps: '15', rpeTarget: 7, notes: 'Optional — skip if recovery is low' }),
    ],
  },
  {
    id: 'ch-w5-d5', name: 'Day 5 — Bench MR Test',
    exercises: [
      pe(EXERCISES.bench, { sets: 1, reps: 'MR', loadPercentage: 96, notes: 'AMRAP @ RPE 10 (95-97.5%). Project new 1RM from reps × multiplier. No back-off, no accessories — preserve recovery for taper week.' }),
    ],
  },
];

// ─── WEEK 6 ─ Taper + Test Day ───────────────────────────────────────────
// Day 5 of the taper is the test day itself: 3 attempts per lift. Percentages
// reference the lifter's projected 1RMs from Week 5 — the app should prompt
// for new 1RM inputs before computing Week 6 loads.
const w6: ProgramDay[] = [
  {
    id: 'ch-w6-d1', name: 'Day 1 — Squat + Bench Openers Practice',
    exercises: [
      pe(EXERCISES.squat, { sets: 2, reps: '2', loadPercentage: 92, notes: 'Opener weight — must feel like RPE 7-8' }),
      pe(EXERCISES.bench, { sets: 2, reps: '2', loadPercentage: 93, notes: 'Opener weight' }),
    ],
  },
  {
    id: 'ch-w6-d2', name: 'Day 2 — DL Opener + Bench Singles',
    exercises: [
      pe(EXERCISES.deadlift, { sets: 2, reps: '2', loadPercentage: 92, notes: 'Opener weight' }),
      pe(EXERCISES.bench,    { sets: 3, reps: '1', loadPercentage: 86, notes: 'Speed work — bar moves crisp' }),
    ],
  },
  {
    id: 'ch-w6-d3', name: 'Day 3 — Light Triples (all lifts)',
    exercises: [
      pe(EXERCISES.squat,    { sets: 2, reps: '3', loadPercentage: 75 }),
      pe(EXERCISES.bench,    { sets: 2, reps: '3', loadPercentage: 75 }),
      pe(EXERCISES.deadlift, { sets: 1, reps: '3', loadPercentage: 75 }),
    ],
  },
  {
    id: 'ch-w6-d4', name: 'Day 4 — Recovery (Empty Bar / Mobility)',
    exercises: [],
  },
  {
    id: 'ch-w6-d5', name: 'Day 5 — TEST DAY (3 attempts each lift)',
    exercises: [
      pe(EXERCISES.squat,    { sets: 1, reps: '1', loadPercentage: 92,  notes: 'Opener (~RPE 7-8) — must be a guaranteed lift' }),
      pe(EXERCISES.squat,    { sets: 1, reps: '1', loadPercentage: 97,  notes: '2nd attempt (~RPE 9)' }),
      pe(EXERCISES.squat,    { sets: 1, reps: '1', loadPercentage: 100, rpeTarget: 10, notes: '3rd attempt — true 1RM' }),
      pe(EXERCISES.bench,    { sets: 1, reps: '1', loadPercentage: 93,  notes: 'Opener (~RPE 7-8)' }),
      pe(EXERCISES.bench,    { sets: 1, reps: '1', loadPercentage: 97,  notes: '2nd attempt (~RPE 9)' }),
      pe(EXERCISES.bench,    { sets: 1, reps: '1', loadPercentage: 100, rpeTarget: 10, notes: '3rd attempt — true 1RM' }),
      pe(EXERCISES.deadlift, { sets: 1, reps: '1', loadPercentage: 92,  notes: 'Opener (~RPE 7-8)' }),
      pe(EXERCISES.deadlift, { sets: 1, reps: '1', loadPercentage: 97,  notes: '2nd attempt (~RPE 9)' }),
      pe(EXERCISES.deadlift, { sets: 1, reps: '1', loadPercentage: 100, rpeTarget: 10, notes: '3rd attempt — true 1RM' }),
    ],
  },
];

const blocks: ProgramBlock[] = [
  {
    id: 'ch-b1',
    name: 'Hypertrophy',
    focus: 'Volume',
    weeks: [
      { id: 'ch-b1w1', weekNumber: 1, days: w1 },
      { id: 'ch-b1w2', weekNumber: 2, days: w2 },
    ],
  },
  {
    id: 'ch-b2',
    name: 'Intensification',
    focus: 'Strength',
    weeks: [
      { id: 'ch-b2w1', weekNumber: 3, days: w3 },
      { id: 'ch-b2w2', weekNumber: 4, days: w4 },
    ],
  },
  {
    id: 'ch-b3',
    name: 'Realization',
    focus: 'Peaking',
    weeks: [
      { id: 'ch-b3w1', weekNumber: 5, days: w5 },
      { id: 'ch-b3w2', weekNumber: 6, days: w6 },
    ],
  },
];

export const canditoHybridProgram: Program = {
  id: 'candito-hybrid-v1',
  name: 'Candito Hybrid · 6-Week Powerlifting',
  blocks,
  currentBlockIndex: 0,
  currentWeekIndex: 0,
  currentDayIndex: 0,
};
