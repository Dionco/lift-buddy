# Rest timer state lives in the store, not in component-local state

The active session's rest-timer state — the absolute timestamp when the current rest ends — is held on the Zustand training store as `restEndsAt: number | null`, not as `useState` inside `ActiveWorkout.tsx`. `null` means "not resting"; a unix-ms timestamp means "rest expires at that instant". A small JS tick effect drives the on-screen countdown and calls `endRest()` to clear the field when the timestamp passes.

## Why

A future Live Activity / Dynamic Island feature (spec dated 2026-05-25) needs to observe rest-timer state from a store subscriber that runs at the React tree root — outside `ActiveWorkout.tsx`. Component-local state isn't reachable from a top-level subscriber without prop-drilling or context, both of which couple the Live Activity bridge to the active-workout UI tree. Storing the absolute expiry timestamp also lets iOS render an OS-driven countdown via `Text(timerInterval:)` without our app ticking.

Storing the *absolute end timestamp* (not a remaining counter) means the value is correct across re-mounts and across the JS↔Swift bridge boundary: anyone with the timestamp can compute remaining at any moment. The store doesn't decrement; only `startRest` and `endRest` mutate it.

## Considered alternatives

**Keep rest state in `ActiveWorkout.tsx`, expose via context.** Adds a React context just for the bridge subscriber. The context provider would still have to live at the tree root. Net effect: same plumbing, plus the indirection of context — for no benefit.

**Store remaining seconds, decrement on a store-level tick.** Forces the store to schedule a recurring `set()` call. Works, but makes the store time-dependent (a `setInterval` lifetime tied to the store's lifetime) and gives downstream consumers a stale-by-design value (always 1 tick behind). The absolute-timestamp form is purely declarative.

**Carry an `idle | running | paused` phase alongside `restEndsAt`.** Would preserve the pre-refactor manual-start and pause/resume UX. Rejected: the three useState hooks ARE that representation. Putting them in the store unchanged buys nothing for the bridge, since the bridge only cares about "is the lifter resting right now?" — which is a single bit. The simpler shape forces the UX simplification described below, which is itself desirable (one fewer way to forget to start the rest).

## Consequences

- `restEndsAt` is cleared at any transition that ends the active session: `startSession`, `finishSession`, `cancelSession`. The invariant is: `restEndsAt !== null` implies `activeSession !== null`.
- **User-visible UX change:** the rest pill now **auto-starts** when a set is completed (previously the lifter had to tap the pill to begin). Mid-rest, tapping the pill **skips the remaining time** (previously: pause/resume). Pause is removed; with an absolute timestamp it has no clean representation. Tap-to-skip + tap-to-restart is the equivalent two-tap path.
- The on-screen countdown in `ActiveWorkout.tsx` becomes derived: `remaining = Math.max(0, restEndsAt - now) / 1000`. A small `useEffect` drives a per-second re-render and calls `endRest()` at expiry.
- Un-toggling a previously-completed set does **not** clear the rest. Rationale: tap-then-immediately-retap (typo correction) would otherwise reset the rest clock, which is a worse UX than letting the rest run.
- The dead `src/components/RestTimer.tsx` file is removed — it was never imported.
- The dead `restTimerDuration` store field and `setRestTimerDuration` action are removed in the same v8 migration. They were initialised to 120 and never read by any UI; `suggestRest(reps, exercise)` is the actual per-rest duration source.
- Persisted v8 stores migrate to v9 by gaining `restEndsAt: null` and dropping `restTimerDuration`. No user-visible data loss (no v8 store carried `restEndsAt`; nothing consumes `restTimerDuration`). The bump is to v9 rather than v8 because a concurrent feature (`ExerciseLog.id` backfill) had already claimed v8 — the two migrations are independent and additive.
