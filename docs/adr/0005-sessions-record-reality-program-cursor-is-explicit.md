# Sessions record reality; program cursor advances by explicit action

A Session is a record of what the lifter actually did. It does not enforce the program. Specifically:

- **Ad-hoc workouts** are first-class — `programDayId` is optional, and Sessions without one are fully supported (counts for e1RM, shows in History).
- **Adding exercises** during a programmed Day is allowed; extras are stored as normal `ExerciseLog` entries on the Session and flagged as "not prescribed" in the Summary view.
- **Skipping or swapping exercises** is allowed; the omitted exercises simply don't appear on the Session. We never fabricate `completed: false` placeholder sets — absence is the signal. The Summary diffs Session vs Day to surface "prescribed but not done."
- **Multiple Sessions can reference the same Day** (e.g. abandoned warmup, retried later). Each is preserved in History; the lifter marks the one that "counts."
- **Out-of-order execution is allowed** — the lifter can do Day 3 before Day 2; the program cursor doesn't move automatically.

The progression cursor (current Block / Week / Day) advances only by **explicit lifter action on the Session Summary** — typically a "Mark complete and advance" button. It is never derived from session count, session end-time, or any other implicit signal.

## Why

Real lifters routinely deviate from the plan: substitutions for sore joints, extra accessory work, abandoned sessions after bad warmups, double sessions in a day, week-skips for travel. A model that treats deviations as errors will either reject valid data or guess wrong. Treating Sessions as a record of reality and the cursor as an explicit pointer cleanly separates "what happened" from "what the program thinks should happen next" — and lets them disagree without contradiction.

## Consequences

- The Session Summary is the single source of cursor mutation; nothing else in the app should advance the program.
- The `Day vs Session` diff is a real computation the Summary view depends on — needs to be implemented as a pure function over the two.
- Reporting/analytics that ask "did the lifter follow the program?" need to derive adherence from the diff, not from the cursor.
- Importing program data must not assume Day completion implies cursor position; track them separately.
