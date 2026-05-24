/**
 * Candito 6-Week Program AMRAP → projected 1RM multipliers.
 *
 * After the Week 5 MR (max-reps) test sets, the lifter projects a new
 * Training Max for each Main Lift as `multiplier × top-set weight`, where the
 * multiplier is keyed by reps achieved at the prescribed percentage. Surfaced
 * inline in the Week-5-complete nudge so the lifter can do the projection
 * without leaving the app.
 *
 * Source: `docs/candito_program_explained.md`.
 */
export const CANDITO_REP_MULTIPLIERS: ReadonlyArray<{ reps: number; mult: number }> = [
  { reps: 1, mult: 1.0 },
  { reps: 2, mult: 1.04 },
  { reps: 3, mult: 1.09 },
  { reps: 4, mult: 1.12 },
  { reps: 5, mult: 1.16 },
  { reps: 6, mult: 1.19 },
  { reps: 7, mult: 1.23 },
];
