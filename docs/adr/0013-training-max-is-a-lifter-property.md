# Training Max is a lifter property, not a program property

The lifter's Training Max for each Main Lift is stored at the top level of the training store, not nested under `program.config` or similar. A lifter's squat is their squat regardless of which **Program** they're running; switching programs (currently hypothetical — one active program at a time) preserves the values, and updating Training Max mid-program changes all upcoming weights immediately without resetting the cursor. The only time Training Max is cleared is on `restartProgram()`, which is a deliberate checkpoint after a multi-week block, not a consequence of the program identity changing.

`loadingIncrement` follows the same model for the same reason — it's a property of the lifter's gym, not the program.

## Considered alternatives

**Program-owned Training Max.** Each Program would carry its own `trainingMaxes` config block. Initially seductive because it lets two programs disagree about the lifter's Training Max (e.g. a powerbuilding program intentionally lower than a powerlifting program). Rejected: that use case isn't real yet, and the model fights physics — the lifter's strength is invariant across programs, so forcing re-entry on every program change creates friction the lifter can't avoid by being careful.

## Consequences

- The "Update Training Maxes" editor and the "Restart Program" action are cleanly orthogonal — Update touches maxes only; Restart touches cursor and maxes together. Two distinct surfaces.
- A future "Settings / Profile" screen has a natural home for Training Max + loading increment without needing to special-case "program is active vs not".
- If a future program legitimately needs its own Training Max convention (e.g. Wendler-style at 90% of tested), that program is responsible for applying its own multiplier to the lifter's stored Training Max — the convention belongs to the program, the strength baseline belongs to the lifter.
