# Accessory progression nudge uses the strict Double Progression rule

The in-session TARGET tile and the future Progress tab share one primitive — `nextAccessorySuggestion(prevSets, prescription)` in `src/lib/progressSignal.ts` — for telling the lifter what to aim for on an accessory exercise. That primitive can choose between a **strict** and a **loose** reading of CONTEXT.md → Double Progression:

- **Strict**: emit `add-load` only when **all** prescribed sets in the previous session hit the **top of the prescribed rep range** at an RPE **at or below** the prescription's `rpeTarget`. Otherwise emit `add-reps` (or `match` if the previous session was below the bottom of the range, e.g. a regression).
- **Loose**: emit `add-load` when any set, or the last set, hits the top of the range — on the theory that "deepest" sets running out of range mean the lifter has overflow capacity.

We choose **strict**.

## Why

The whole point of a rep range is that the lifter accumulates productive volume across the range before jumping the load. If we promote the load on the first session a single set tops out, the rest of the range is wasted — the lifter never built the capacity the range was designed to build, and the load jump tends to undo recent gains.

The RPE-target constraint matters separately: a lifter who hit top-of-range reps at an RPE above the prescription was working *harder* than the program asked for. That's not "ready for more load" — it's "earning more load on the wrong side of effort." The double-progression rule assumes consistent effort across the range, not effort drift.

## Consequences

- `nextAccessorySuggestion` lives in `src/lib/progressSignal.ts`, alongside `e1rm.ts` and `volume.ts`. The active-session TARGET tile (`SetRow` in `ActiveWorkout.tsx`) and the Progress tab both call this single primitive.
- Suggestion shape: `'add-load' | 'add-reps' | 'match' | 'first-time'`. `'add-reps'` carries the next target rep count. `'add-load'` carries a copy text only — the lifter chooses the increment.
- For prescriptions without an `rpeTarget`, the RPE constraint drops and the threshold becomes "all sets at top of range."
- Lifters who explicitly want looser progression can override by editing the load themselves — the nudge is advisory, never enforced.
- This ADR governs the *accessory* progress signal only. Main Lifts use the e1RM-slope rule per ADR-0008.
