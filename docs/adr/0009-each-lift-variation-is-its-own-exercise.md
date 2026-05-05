# Each lift variation is its own Exercise

Movement variations (Paused Squat, Tempo Squat, SSB Squat, Close-Grip Bench, Paused Bench, Sumo Deadlift, Deficit Deadlift, RDL, etc.) are modelled as separate `Exercise` rows in the library. They are not stored as a `variation` field on a shared movement, and they are not children in a hierarchy. Each variation has its own e1RM history, its own PRs, and appears as its own line in Progress views.

Variations of a Main Lift are explicitly **not** Main Lifts. The `Main Lift` concept stays anchored to the three competition lifts (Squat, Bench Press, Deadlift) — Paused Squat is a heavy compound exercise, not a Main Lift. Per ADR-0008, e1RM slope still applies as the progress signal for any heavy 1–5 rep work, so variations get a proper trend chart even though they're not Main Lifts.

A Variation may carry an optional `relatedTo` tag pointing at its parent Main Lift, used only for grouping in UI ("show me all my squat variations"). It is never used to aggregate data — trend lines and PRs always stay per-Exercise.

## Why

A paused squat e1RM is roughly 10% below a competition squat e1RM at the same RPE. If they shared an Exercise row, the trend would jitter every time the program switched between variations, and PR detection would fire incorrectly when the lifter "PRs" a competition squat that's actually below their paused squat estimate. Storing them separately keeps every trend interpretable. The cost is a larger exercise library — acceptable, since the meaningful set is bounded (~30 lifts including all common variations).

## Consequences

- The exercise library will grow: each meaningful variation is its own row with its own `id`, `name`, and `muscleGroup`.
- Adding a Variation in the UI should be a quick action — searching "squat" should surface Squat, Paused Squat, Tempo Squat, etc. as separate selectable rows.
- Programs that prescribe specific variations reference the variation's Exercise directly — no "squat with pause flag" pattern.
- A future "show all my squats" view is a UI-level grouping by `relatedTo`, not a data aggregation.
- Importing programs that say "Squat 5×5 (paused)" requires explicit mapping at the import boundary to the right Exercise row.
