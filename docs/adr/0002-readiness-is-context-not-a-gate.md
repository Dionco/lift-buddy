# Readiness is context, not a gate

The pre-session Readiness check (sleep, energy, soreness) is captured for retrospective interpretation only. It does not warn the lifter, adjust the prescription, or trigger auto-deloads. The lifter starts and runs the session regardless of what they entered.

We chose this because RPE is already the autoregulation mechanism — a heavy day will naturally show up as elevated RPE on the prescribed work, and the lifter can adjust load mid-session. Layering a second autoregulation system on top of RPE adds noise and competing signals. Readiness instead serves as journal data: it surfaces in the Session Summary and Progress views to help the lifter interpret a bad day after the fact.

## Consequences

- The Readiness screen is a journaling moment, not a decision point — UI should reflect this (no scary warnings on low scores).
- Future features that want to act on Readiness (auto-deload, "skip today" suggestions) need to revisit this ADR rather than slipping the change in.
- Progress views should chart Readiness alongside e1RM so trends are visible.
