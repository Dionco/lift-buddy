# One Active Program at a time, with prompted Block advance

A lifter has at most one Active Program. The Train tab, progression cursor, and "what's next" logic all assume this — there is no concept of running two programs in parallel. Switching to a new program ends the previous one's active state (history is preserved; the cursor is not).

When the lifter completes the last Day of the last Week of a Block, the app does **not** auto-advance to the next Block. Instead it prompts: advance, repeat the block, insert a deload, or jump elsewhere. Block boundaries are the most common moment for lifters to deviate from the plan (deloads, life events, fatigue management), so silent progression would be wrong more often than it would be right. Within a Block, day-to-day and week-to-week advance is automatic.

## Consequences

- The store models a single `activeProgramId` (or equivalent), not a collection.
- Importing a new program while one is active needs an explicit "switch" UI; we don't silently replace.
- The end-of-block prompt is a real feature, not a nice-to-have — without it, lifters will hit a dead end or auto-advance into work they didn't want.
- Day-level and week-level advance can stay implicit (no prompt).
