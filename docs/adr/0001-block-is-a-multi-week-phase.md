# Block is a multi-week phase, not a single week

The original `ProgramBlock` type modelled a Block as a single week (`weekNumber: number`), with sample data using one block per week. This conflicts with standard powerlifting periodization, where a Block is a multi-week phase with a single focus (Accumulation, Intensification, Peaking, Deload) and a Week is the unit inside it.

We are adopting the canonical powerlifting meaning: **Block = multi-week phase**, **Week = one week inside a block**. New programs should be modelled with a Week layer between Block and Day. The existing `weekNumber: number` field on `ProgramBlock` is misnamed and should be migrated to either a `weeks: Week[]` collection or a duration + current-week index, depending on what the program runner needs.

## Consequences

- The data model needs a new `Week` layer between `ProgramBlock` and `ProgramDay`. Existing seeded programs will need a migration or a one-time rewrite of the sample data.
- Glossary, UI labels, and any progress-tracking logic that currently equates "block" with "week" must be updated.
- This unlocks correctly expressing real powerlifting programs (e.g. Candito's 6-week program — see `docs/candito_program_explained.md`), which the current model cannot represent without abuse.
