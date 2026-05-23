# SetLog records actual performance, not the prescription

`SetLog.reps` is always what the lifter actually did, not what was prescribed. A missed-rep set (prescribed 3, got 2) is stored as `reps: 2, completed: true` — not `reps: 3, completed: false`. "Missed reps" is a derived comparison of the Set against the corresponding Prescription, never a stored flag.

`SetLog.completed: boolean` means "this set was performed and logged" — i.e. it should count for e1RM, volume, and history. Skipped sets are represented by **absence from the Session's exercise log**, not by `completed: false` or a separate `skipped` flag. There is intentionally no skipped-set concept in the data model.

## Why

Storing prescription numbers in the Set would force every read site to know which field to trust, and a missed set would lose the actual rep count. Treating SetLog as a pure record of reality keeps it cleanly aligned with ADR-0005 (Sessions record reality) and lets adherence/missed-rep views be computed by diffing against the Prescription.

## Consequences

- All read sites that compute "missed reps" must do so by comparing `SetLog.reps` to the matching `Prescription.reps`. There is no shortcut field.
- Validation: `reps` should not be defaulted to the prescription value when a Set is logged — it must come from lifter input. **`rpe` follows the same rule**: a SetLog is not logged until the lifter explicitly picks an RPE. Defaulting to `prescription.rpeTarget` would contaminate the Fatigue Signal (which is defined as RPE drift on the same load/reps) — by construction, every recorded RPE would equal the prescribed RPE and drift would be undetectable.
- A "skipped set" UI doesn't write a SetLog at all; it just doesn't add one.
