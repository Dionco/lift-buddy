# `diffSessionAgainstDay` consumes prescriptions in order, not by exercise id

Programs can prescribe the same exercise multiple times in one Day — ascending squat triples (88% → 90% → 92%), an MR set plus its back-off, three test-day attempts (opener / 2nd / 3rd) — and each entry carries its own `loadPercentage`, `notes`, and `rpeTarget`. To diff a Session against a Day correctly, we walk `day.exercises` and `session.exercises` as ordered sequences and claim the next unconsumed matching log for each prescription, rather than keying both into Maps by `exercise.id`. The original Map-keyed approach silently collapsed duplicates (last entry wins), which would have made the Session Summary's skipped / missed-reps diff lie on exactly the weeks where the program demands the most (Candito Hybrid's Weeks 2, 4, and 6).

This relies on a soft invariant: the lifter logs in roughly the prescribed order. `ActiveWorkout` reinforces this by rendering each prescription entry as a separate `ExerciseBlock` in prescribed order, so the natural logging path fills slots 0, 1, 2 sequentially. Out-of-order logging mismatches *which* prescription a given log "belongs to" for missed-reps reporting, but the *counts* of skipped / bonus remain correct — an acceptable degradation that avoids introducing a stable `slotId` field on `SetLog`.

## Consequences

- The diff is no longer commutative with respect to log/prescription order. Tests must cover at least: adjacent duplicates all logged → no skips; duplicates partially logged → exactly the unlogged ones flagged; duplicate prescription with reps short → missed-reps reported.
- `ProgramDay.exercises` is meaningful as a *sequence*, not a *set*. Future code that reorders or deduplicates prescriptions (e.g. "show me the unique exercises in this day") must explicitly preserve duplicates when feeding the diff.
- Any future refactor that "simplifies" the diff back to a Map-keyed-by-id pattern silently re-introduces the Week 2/4/6 correctness bug. This ADR is the load-bearing comment.
