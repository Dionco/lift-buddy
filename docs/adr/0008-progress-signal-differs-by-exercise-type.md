# Progress signal: e1RM slope for Main Lifts, double progression for Accessories

The canonical answer to "is this lifter getting stronger on this exercise?" depends on exercise type:

- **Main Lifts (Squat / Bench Press / Deadlift):** positive slope of top-set e1RM within a comparable rep range over the trailing window (default 4 weeks or 6 sessions, whichever is more). e1RM is reliable for heavy compound work in the 1–5 rep range; cross-rep-range comparisons are not.
- **Accessories:** double progression — hitting more reps within the prescribed range, or adding load after hitting the top of the range. e1RM is *computed* for accessories (per ADR-0003) and shown for completeness, but it is not the canonical progress signal because e1RM error grows significantly above 10 reps and accessory work usually lives there.

Personal Records (new all-time-high top-set e1RM) are tracked separately for every exercise as a celebratory moment, not a trend metric. Volume is a recoverability metric (against MEV/MAV/MRV) rather than a progress metric. A declining e1RM slope on Main Lifts over 3+ consecutive sessions is the **Fatigue Signal**, surfaced as a deload suggestion (never auto-triggered, per ADR-0002 spirit).

## Why

Powerlifting tracks strength on the three competition lifts; e1RM-from-RPE is the standard tool because the formula is reliable in the 1–5 rep range where Main Lift work concentrates. Accessories typically run 8–15+ reps, where e1RM error is high and trend signal would be dominated by noise — but lifters genuinely need a progress signal there too, and double progression is the established answer (also in `docs/powerlifting-knowledge.md`). Conflating these into one "e1RM trend" metric would either silence accessory progress or mislead with bad data.

Volume isn't a stand-in for progress: a lifter can hit MAV every week and still not get stronger if intensity stagnates. Treating volume as a recoverability axis (MEV/MAV/MRV) and progress as a separate axis keeps both interpretable.

## Consequences

- The Progress tab needs two distinct UIs: a Main Lift trend chart (e1RM slope per rep-range bucket) and an Accessory progression view (load × top-rep over time, possibly with the active rep range highlighted).
- "Same rep range" bucketing is required for the Main Lift slope — comparing a 3-rep top set against a 10-rep top set is forbidden by the ADR. Bucketing rule (e.g. "1–5 reps" vs "6–10 reps" vs "11+") is an implementation detail, not a domain concept.
- Volume tracking remains its own feature with its own UI (per-muscle-group sets/week vs MEV/MAV/MRV). Don't merge it into the progress chart.
- PRs trigger UI flourishes on the Session Summary; they do not affect the slope or fatigue signals.
- The Fatigue Signal is the only place where a *negative* trend has explicit semantics — surfaced as a deload suggestion, never as a "you're getting weaker" message.
