# e1RM is computed for every exercise, not just Main Lifts

The original code restricted e1RM calculation to the three competition lifts (Squat, Bench Press, Deadlift) via the `Exercise.isMainLift` flag. The justification was philosophical purity — only competition lifts "deserve" estimated maxes — but the practical effect was that lifters had no way to verify progressive overload on accessories.

We are extending e1RM to every exercise. The formula works for any set with weight, reps, and RPE; the noise is higher on light/high-rep accessories but the trend line is still useful for confirming whether overload is happening. The **Main Lift** distinction remains as an editorial concept (these are what the lifter trains for, so they get prominent placement in Progress views) but no longer gates the calculation itself.

## Consequences

- `getTopSetE1RM` should run for any `ExerciseLog`, not just main lifts. Existing call sites that gate on `isMainLift` need to be reviewed.
- Progress views can show e1RM trend lines for accessories, with appropriate framing ("trend confidence is lower for high-rep accessories").
- The `isMainLift` flag stays — it's still meaningful for ordering and emphasis in the UI.
