# Dynamic Island — Plan A: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap lift-buddy with Capacitor so it runs as a native iOS app loading the web UI in WKWebView, and move rest-timer state from `ActiveWorkout.tsx`'s local React state into the Zustand store (with a v8 migration that also removes the dead `restTimerDuration` field). End state: the iOS Simulator boots and shows the same UI as the web build; the rest timer is store-backed; the rest-pill UX is **intentionally simplified** — auto-start on set completion (was: lifter-tap to start) and tap-to-skip mid-rest (was: tap-to-pause/resume). The spec at `docs/superpowers/specs/2026-05-25-dynamic-island-live-activity-design.md` is the rationale; this plan is what Plan B (the Live Activity feature itself) builds on.

**Architecture:** Capacitor is added as a thin native shell — `bun run build:ios` outputs to `dist/` with VitePWA gated off, then `bunx cap sync` copies that into `ios/App/App/public/`. The Vite/React source stays untouched apart from the rest-timer refactor and a one-line `vite.config.ts` PWA guard. The rest-timer refactor swaps three `useState` hooks for two new Zustand actions (`startRest`, `endRest`) plus one new store field (`restEndsAt: number | null`), deletes the dead `RestTimer.tsx`, and removes the never-read `restTimerDuration` store field.

**Tech Stack:** Vite 5, React 18.3, Zustand (persisted), TypeScript, Vitest+jsdom, Capacitor 6, iOS 17.0 deployment target.

**Spec:** `docs/superpowers/specs/2026-05-25-dynamic-island-live-activity-design.md`

**Scope context:** lift-buddy is personal use only — single device (iPhone 14 Pro, iOS 26.4.2). Deployment target is iOS 17.0 to keep Plan B's widget code free of `if #available` branches. No App Store, no fleet, no wider-device hedging.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `docs/adr/0014-rest-timer-state-in-store.md` | New | ADR for the rest-timer-in-store refactor (incl. the deliberate UX shift) |
| `docs/superpowers/specs/2026-05-25-dynamic-island-live-activity-design.md` | Modify | Spec line 140 — replace `restTimerDuration` reference with `suggestRest(reps, exercise)` |
| `src/store/useTrainingStore.ts` | Modify | Add `restEndsAt`, `startRest`, `endRest`; clear at session boundaries; v8 migration; **remove dead `restTimerDuration` field and `setRestTimerDuration` action** |
| `src/test/restTimerStore.test.ts` | New | Tests for the new actions, session-boundary clearing, and v8 migration (incl. `restTimerDuration` removal) |
| `src/components/ActiveWorkout.tsx` | Modify | Replace local `useState`s with store-derived rest state; **auto-start on set completion**; un-toggle does **not** clear the rest |
| `src/components/RestTimer.tsx` | Delete | Dead code; never imported |
| `vite.config.ts` | Modify | Gate `VitePWA(...)` behind `mode !== "capacitor"` so the iOS bundle has no service worker |
| `package.json` | Modify | Add `@capacitor/core`, `@capacitor/ios` (deps); `@capacitor/cli` (devDep); add `build:ios` script |
| `capacitor.config.ts` | New | `appId`, `webDir`, iOS settings |
| `.gitignore` | Modify | Exclude `ios/App/App/public/`, `ios/DerivedData/`, Pods, xcuserdata |
| `ios/` | New (generated) | Full Xcode project tree from `bunx cap add ios` |
| `ios/App/App/Info.plist` | Modify | Add `NSSupportsLiveActivities=YES`, URL scheme `liftbuddy` |
| `ios/App/App.xcodeproj/project.pbxproj` | Modify (via Xcode UI) | `IPHONEOS_DEPLOYMENT_TARGET=17.0` on project + App target |
| `CLAUDE.md` | Modify | Document iOS build commands + iOS shell architecture |

---

## Task 1: ADR for moving rest timer state into the store (and fix the spec)

**Files:**
- Create: `docs/adr/0014-rest-timer-state-in-store.md`
- Modify: `docs/superpowers/specs/2026-05-25-dynamic-island-live-activity-design.md`

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0014-rest-timer-state-in-store.md` with:

```markdown
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
- Persisted v7 stores migrate to v8 by gaining `restEndsAt: null` and dropping `restTimerDuration`. No user-visible data loss (no v7 store carried `restEndsAt`; nothing consumes `restTimerDuration`).
```

- [ ] **Step 2: Fix the spec's mistaken `restTimerDuration` reference**

In `docs/superpowers/specs/2026-05-25-dynamic-island-live-activity-design.md`, find the `## State Machine` block (around line 140):

```
updateSet({completed: true})        →  update(state)       →  activity.update
  (last set in exercise; phase=resting,
   restEndsAt: now + restTimerDuration)
```

Replace `restTimerDuration` with `suggestRest(reps, exercise)`:

```
updateSet({completed: true})        →  update(state)       →  activity.update
  (set completed; phase=resting,
   restEndsAt: now + suggestRest(reps, exercise) * 1000)
```

This matches the actual code in `ActiveWorkout.tsx:883,1076`. The "last set in exercise" qualifier is also dropped — every completed set auto-rests, not just the last per exercise.

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0014-rest-timer-state-in-store.md docs/superpowers/specs/2026-05-25-dynamic-island-live-activity-design.md
git commit -m "$(cat <<'EOF'
docs(adr): rest timer state lives in the store, not component-local

Captures the rationale for moving rest-timer state out of ActiveWorkout's
useState into the Zustand store — needed for the upcoming Dynamic Island
Live Activity to observe rest state from a tree-root subscriber. Also
records the deliberate UX shift (auto-start + tap-to-skip; no pause), the
removal of the never-read restTimerDuration field, and corrects the spec's
stray restTimerDuration reference.
EOF
)"
```

---

## Task 2: Add `restEndsAt`, `startRest`, `endRest` to the store

**Files:**
- Modify: `src/store/useTrainingStore.ts` (TrainingState interface, initial state, actions)
- Create: `src/test/restTimerStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/test/restTimerStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTrainingStore } from '@/store/useTrainingStore';

describe('rest timer store slice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
    localStorage.clear();
    useTrainingStore.setState({ restEndsAt: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with restEndsAt === null', () => {
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });

  it('startRest(120) sets restEndsAt = now + 120_000', () => {
    useTrainingStore.getState().startRest(120);
    expect(useTrainingStore.getState().restEndsAt).toBe(Date.now() + 120_000);
  });

  it('endRest() clears restEndsAt to null', () => {
    useTrainingStore.getState().startRest(180);
    useTrainingStore.getState().endRest();
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });

  it('startRest with zero duration sets restEndsAt to now', () => {
    useTrainingStore.getState().startRest(0);
    expect(useTrainingStore.getState().restEndsAt).toBe(Date.now());
  });

  it('repeated startRest overwrites the previous restEndsAt', () => {
    useTrainingStore.getState().startRest(60);
    const first = useTrainingStore.getState().restEndsAt;
    vi.advanceTimersByTime(5_000);
    useTrainingStore.getState().startRest(120);
    const second = useTrainingStore.getState().restEndsAt;
    expect(second).not.toBe(first);
    expect(second).toBe(Date.now() + 120_000);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: 5 failures with errors like `TypeError: useTrainingStore.getState().startRest is not a function`.

- [ ] **Step 3: Modify the store**

In `src/store/useTrainingStore.ts`, the `TrainingState` interface gets two new actions and one new field. The initial state object gets the field.

Find the `lastReadiness` block in the `TrainingState` interface and add `restEndsAt` plus action signatures:

```ts
  /** Most recent Readiness check-in… */
  lastReadiness: { readiness: ReadinessCheckIn; timestamp: number } | null;
  /** Absolute unix-ms timestamp when the active rest period ends, or null when not resting.
   *  `null` is the canonical "not resting" sentinel; any timestamp (past or future) means
   *  startRest was the most recent transition. Cleared by endRest, finishSession,
   *  cancelSession, and startSession. See ADR-0014. */
  restEndsAt: number | null;
```

In the same interface, near the other action signatures:

```ts
  /** Start a rest period; sets restEndsAt = Date.now() + durationSeconds * 1000.
   *  Idempotent — calling again overwrites the previous timestamp. */
  startRest: (durationSeconds: number) => void;
  /** Clear restEndsAt to null. Called by the in-component tick effect at expiry,
   *  or by the lifter tapping the rest pill mid-rest to skip the remainder. */
  endRest: () => void;
```

Find the `lastReadiness: null,` initial-state line and add `restEndsAt`:

```ts
      lastReadiness: null,
      restEndsAt: null,
```

Near the other small actions (after `setLoadingIncrement`), add the implementations:

```ts
      startRest: (durationSeconds) =>
        set({ restEndsAt: Date.now() + durationSeconds * 1000 }),

      endRest: () => set({ restEndsAt: null }),
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/store/useTrainingStore.ts src/test/restTimerStore.test.ts
git commit -m "$(cat <<'EOF'
feat(store): add restEndsAt slice with startRest/endRest actions

restEndsAt is an absolute unix-ms timestamp (or null when not resting).
This shape lets future consumers compute remaining time deterministically
without needing the store to tick. Implements first half of ADR-0014.
EOF
)"
```

---

## Task 3: Clear `restEndsAt` at session-lifecycle boundaries

**Files:**
- Modify: `src/store/useTrainingStore.ts` (`startSession`, `finishSession`, `cancelSession`)
- Modify: `src/test/restTimerStore.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/test/restTimerStore.test.ts`:

```ts
describe('rest timer cleared on session boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
    localStorage.clear();
    useTrainingStore.setState({
      activeSession: {
        id: 'session-test',
        startTime: Date.now(),
        exercises: [],
      },
      restEndsAt: Date.now() + 60_000,
    });
  });
  afterEach(() => vi.useRealTimers());

  it('cancelSession() clears restEndsAt', () => {
    useTrainingStore.getState().cancelSession();
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });

  it('finishSession() clears restEndsAt', () => {
    useTrainingStore.getState().finishSession();
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });

  it('startSession() resets restEndsAt to null even if one was lingering', () => {
    useTrainingStore.setState({ activeSession: null, restEndsAt: 9999999999999 });
    useTrainingStore.getState().startSession('Test workout');
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: 3 new failures.

- [ ] **Step 3: Update the three actions**

In `startSession`, change `set({ activeSession: session });` to:

```ts
        set({ activeSession: session, restEndsAt: null });
```

In `finishSession`, find the final `set({...})` call and add `restEndsAt: null`:

```ts
        set({
          sessions: [finished, ...sessions],
          activeSession: null,
          restEndsAt: null,
        });
```

In `cancelSession`, change `cancelSession: () => set({ activeSession: null }),` to:

```ts
      cancelSession: () => set({ activeSession: null, restEndsAt: null }),
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: 8 tests total, all passing.

- [ ] **Step 5: Commit**

```bash
git add src/store/useTrainingStore.ts src/test/restTimerStore.test.ts
git commit -m "$(cat <<'EOF'
feat(store): clear restEndsAt on session lifecycle transitions

Enforces the invariant that restEndsAt !== null implies activeSession !== null.
startSession, finishSession, and cancelSession all null out restEndsAt.
EOF
)"
```

---

## Task 4: Bump persisted store to v8 — add `restEndsAt`, remove dead `restTimerDuration`

**Files:**
- Modify: `src/store/useTrainingStore.ts` (TrainingState interface, initial state, `setRestTimerDuration` action, `migrate()` body, `version`)
- Modify: `src/test/restTimerStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/test/restTimerStore.test.ts`:

```ts
describe('v8 migration', () => {
  it('defaults restEndsAt to null when migrating from v7', () => {
    const v7State = {
      sessions: [],
      program: { id: 'p', name: 'P', blocks: [], currentBlockIndex: 0, currentWeekIndex: 0, currentDayIndex: 0 },
      activeSession: null,
      restTimerDuration: 120,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,
    };
    const v8State = migrate(v7State, 7) as Record<string, unknown>;
    expect(v8State.restEndsAt).toBeNull();
  });

  it('drops the dead restTimerDuration field when migrating from v7', () => {
    const v7State = {
      sessions: [],
      program: { id: 'p', name: 'P', blocks: [], currentBlockIndex: 0, currentWeekIndex: 0, currentDayIndex: 0 },
      activeSession: null,
      restTimerDuration: 90,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,
    };
    const v8State = migrate(v7State, 7) as Record<string, unknown>;
    expect(v8State.restTimerDuration).toBeUndefined();
  });

  it('preserves a non-null restEndsAt that already exists (round-trip v8 → v8)', () => {
    const v8In = {
      sessions: [],
      program: { id: 'p', name: 'P', blocks: [], currentBlockIndex: 0, currentWeekIndex: 0, currentDayIndex: 0 },
      activeSession: null,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,
      restEndsAt: 1234567890,
    };
    const v8Out = migrate(v8In, 8) as Record<string, unknown>;
    expect(v8Out.restEndsAt).toBe(1234567890);
  });
});
```

Add the named import to the top of the test file:

```ts
import { useTrainingStore, migrate } from '@/store/useTrainingStore';
```

- [ ] **Step 2: Run, verify fail**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: the migration tests fail because `migrate` isn't exported and/or the v8 block doesn't exist.

- [ ] **Step 3: Remove `restTimerDuration` from the store**

In `src/store/useTrainingStore.ts`:

- Remove the `restTimerDuration: number;` line from the `TrainingState` interface (around line 14).
- Remove the `setRestTimerDuration: (seconds: number) => void;` signature from the interface (around line 40).
- Remove the `restTimerDuration: 120,` line from the initial state (around line 247).
- Remove the `setRestTimerDuration: (seconds) => set({ restTimerDuration: seconds }),` action (around line 375).

Run: `bunx tsc --noEmit` to confirm no consumers break. Expected: clean (grep already confirmed zero consumers in `src/`).

- [ ] **Step 4: Export `migrate` and add v8 block**

Change `function migrate(...)` to `export function migrate(...)`.

After the v7 block in `migrate`, add:

```ts
  if (version < 8) {
    // v8: introduce `restEndsAt` per ADR-0014 (rest timer moves from
    // ActiveWorkout's component-local state into the store so a future
    // Live Activity bridge can observe it from a tree-root subscriber).
    // Also drop the never-read `restTimerDuration` field — `suggestRest`
    // is the actual per-rest duration source.
    const s = state as TrainingState & {
      restEndsAt?: unknown;
      restTimerDuration?: unknown;
    };
    if (s.restEndsAt === undefined) s.restEndsAt = null;
    delete s.restTimerDuration;
  }
```

Change `version: 7,` in the `persist({...})` options to `version: 8,`.

- [ ] **Step 5: Run, verify pass**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: 11 tests passing.

Run: `bunx vitest run` (the full suite) — confirm no other test broke. The `restTimer.test.ts` file (testing `suggestRest`) is unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/store/useTrainingStore.ts src/test/restTimerStore.test.ts
git commit -m "$(cat <<'EOF'
feat(store): bump persisted store to v8; drop dead restTimerDuration

Adds restEndsAt: null to v7 stores on rehydrate (no data lost — v7 never
carried this field). Also removes the never-read restTimerDuration field
and setRestTimerDuration action; suggestRest(reps, exercise) is the actual
per-rest duration source. migrate() exported for direct testing.
EOF
)"
```

---

## Task 5: Refactor `ActiveWorkout.tsx` to use store-backed rest timer

**Files:**
- Modify: `src/components/ActiveWorkout.tsx` (rest-timer state block + two writer sites + RestPill onToggle)

- [ ] **Step 1: Locate the current implementation**

Rest-timer state in `src/components/ActiveWorkout.tsx` is three `useState` hooks + a tick effect, currently around lines 1129-1144:

```ts
// Manual rest timer.
const [restRemaining, setRestRemaining] = useState(0);
const [restRunning, setRestRunning] = useState(false);
const [restSuggested, setRestSuggested] = useState(180);
useEffect(() => {
  if (!restRunning) return;
  const t = setInterval(() => {
    setRestRemaining((s) => {
      if (s <= 1) {
        setRestRunning(false);
        return 0;
      }
      return s - 1;
    });
  }, 1000);
  return () => clearInterval(t);
}, [restRunning]);
```

Read by callers via `restRemaining`, `restRunning`, `restSuggested`. Written at two set-completion sites (around lines 883-886 and 1076-1079) and the `RestPill onToggle` (around line 1252).

- [ ] **Step 2: Write the replacement block**

Replace the `// Manual rest timer.` block (three `useState`s + the `useEffect`) with:

```ts
// Rest timer — backed by the store via restEndsAt (see ADR-0014).
// restRemaining and restRunning are derived; the only local state is
// `restSuggested` (used to seed an idle-pill restart) and `now` (the
// 1Hz re-render driver for the countdown).
const restEndsAt = useTrainingStore((s) => s.restEndsAt);
const startRest = useTrainingStore((s) => s.startRest);
const endRest = useTrainingStore((s) => s.endRest);
const [restSuggested, setRestSuggested] = useState(180);
const [now, setNow] = useState(() => Date.now());

useEffect(() => {
  if (restEndsAt === null) return;
  const tick = () => {
    const t = Date.now();
    setNow(t);
    if (t >= restEndsAt) endRest();
  };
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, [restEndsAt, endRest]);

const restRemaining =
  restEndsAt === null ? 0 : Math.max(0, Math.ceil((restEndsAt - now) / 1000));
const restRunning = restEndsAt !== null && restEndsAt > now;
```

- [ ] **Step 3: Update the two writer sites — auto-start the rest timer**

At the two set-completion sites (around lines 883-886 and 1076-1079), the existing pattern is:

```ts
setRestSuggested(rest);
setRestRemaining(rest);
setRestRunning(false);  // manual start
```

Change both to:

```ts
setRestSuggested(rest);
startRest(rest);  // Auto-start per ADR-0014. The rest pill now begins
                  // automatically on set completion — the lifter taps
                  // to skip, not to start.
```

**Deliberate UX change** from "load suggested time, lifter taps to start" to "start automatically on set completion." Captured in ADR-0014.

**Un-toggle handling:** the auto-start branch only fires when `nextDone === true` (the first writer site at `~line 880` already guards on this; the second writer site at `~line 1067` is only reached on completion). Un-toggling a previously-completed set does **not** clear the rest — this is intentional (see ADR-0014 Consequences). Do not add an `endRest()` call to the un-toggle path.

- [ ] **Step 4: Update the RestPill onToggle handler**

Around line 1252-1259 the current handler is:

```ts
onToggle={() => {
  if (restRemaining === 0) {
    setRestRemaining(restSuggested);
    setRestRunning(true);
  } else {
    setRestRunning((r) => !r);
  }
}}
```

Replace with:

```ts
onToggle={() => {
  if (restEndsAt === null) {
    // Idle pill tapped — start a fresh rest at the last-suggested duration.
    startRest(restSuggested);
  } else {
    // Mid-rest tap — skip the remaining time.
    endRest();
  }
}}
```

Drops the pause/resume mid-rest UX. With absolute-timestamp state, pause has no clean representation; tap-to-skip + tap-to-restart is the equivalent two-tap path.

- [ ] **Step 5: Run the full test suite**

Run: `bunx vitest run`

Expected: all tests pass. The existing `restTimer.test.ts` (tests `suggestRest` — a pure function) is untouched.

- [ ] **Step 6: Smoke-test in the browser**

Run: `bun run dev`

Open `http://localhost:8080`. Start a session, log a set with the numpad. Confirm:
1. Pill begins counting down **immediately** when a set is marked complete (no tap required).
2. Countdown decrements once per second.
3. When it hits 0, the pill returns to the `REST` idle state.
4. Tapping mid-countdown ends the rest (returns to idle).
5. Tapping the idle pill restarts the rest at the last-suggested duration.
6. Un-toggling a completed set does **not** clear the running rest.

Fix any misbehaviour before committing.

- [ ] **Step 7: Commit**

```bash
git add src/components/ActiveWorkout.tsx
git commit -m "$(cat <<'EOF'
refactor(active-workout): back rest timer with the Zustand store

Replaces three useState hooks (restRemaining/restRunning/restSuggested) with
a store-backed derivation from restEndsAt. The rest pill now auto-starts on
set completion (was: tap-to-start) and mid-rest tap skips the remaining time
(was: tap-to-pause/resume). Un-toggling a completed set deliberately does
NOT clear the rest. Implements the ActiveWorkout side of ADR-0014.
EOF
)"
```

---

## Task 6: Delete the dead `RestTimer.tsx` file

**Files:**
- Delete: `src/components/RestTimer.tsx`

- [ ] **Step 1: Confirm nothing imports it**

Run: `grep -rn "from '@/components/RestTimer'" src/`

Expected: no matches.

Run: `grep -rn "RestTimer" src/ --include="*.ts" --include="*.tsx"`

Expected: only `src/components/RestTimer.tsx` itself. (The `restTimer.test.ts` file tests `lib/restTimer.ts` — different module, leave it.)

- [ ] **Step 2: Delete the file**

Run: `git rm src/components/RestTimer.tsx`

- [ ] **Step 3: Verify build + tests**

Run: `bun run build`

Expected: build succeeds.

Run: `bunx vitest run`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: delete dead RestTimer.tsx component

The component was never imported anywhere — the real rest-timer UI lives
inside ActiveWorkout.tsx as the RestPill subcomponent. Removed during the
ADR-0014 refactor to avoid future confusion.
EOF
)"
```

---

## Task 7: Install Capacitor dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the three Capacitor packages**

CLI is build-time only; install it as a devDependency. Core and iOS are runtime deps.

Run: `bun add @capacitor/core@^6 @capacitor/ios@^6`
Run: `bun add -D @capacitor/cli@^6`

Expected: three new entries in `package.json` — two under `dependencies`, one under `devDependencies`.

Note: Capacitor 6 requires Node 18+. lift-buddy already runs on Node 20 (Vite 5 requirement). Capacitor 7 also works but pin to 6 — `@capacitor/ios@7` requires Xcode 15.4+; using 6 keeps the ceiling looser.

- [ ] **Step 2: Verify install integrity**

Run: `bunx cap --version`

Expected: a 6.x.x version.

Run: `bun run dev` (then Ctrl-C immediately)

Expected: Vite boots without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock*
git commit -m "$(cat <<'EOF'
chore: add Capacitor 6 core, cli, and iOS packages

First step toward wrapping lift-buddy as a native iOS app. @capacitor/cli is
a devDependency (build-time only); core and ios are runtime. The web build
keeps working unchanged; Capacitor only activates on `bunx cap sync` and
when running inside the iOS WebView.
EOF
)"
```

---

## Task 8: Gate VitePWA off for the iOS build

**Why this task exists:** WKWebView serves the Capacitor bundle from `capacitor://localhost`, and **service workers don't register on custom schemes** (iOS 16/17 limitation). Shipping VitePWA's service worker inside the iOS bundle would either silently fail (console noise) or — worse — let a stale SW cache mask `cap sync` updates during development. PWA-on-Vercel and native-on-iOS are two distribution paths; the service worker belongs to the first only.

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (new `build:ios` script)

- [ ] **Step 1: Gate VitePWA behind a non-capacitor build mode**

In `vite.config.ts`, find the plugins array. The current line is:

```ts
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [ ... ],
      workbox: { ... },
      manifest: { ... },
    }),
```

Wrap the entire `VitePWA({...})` call in a `mode !== "capacitor" &&` guard:

```ts
    mode !== "capacitor" && VitePWA({
      registerType: "autoUpdate",
      includeAssets: [ ... ],
      workbox: { ... },
      manifest: { ... },
    }),
```

The existing `.filter(Boolean)` at the end of the plugins array already handles the false case.

- [ ] **Step 2: Add the `build:ios` script**

In `package.json`, find the `scripts` block and add:

```json
    "build:ios": "vite build --mode capacitor",
```

Place it next to the existing `build` script.

- [ ] **Step 3: Verify both builds produce different `dist/` shapes**

Run: `bun run build`

Expected: `dist/sw.js` exists, `dist/manifest.webmanifest` exists, `dist/registerSW.js` exists.

Run: `rm -rf dist && bun run build:ios`

Expected: `dist/sw.js` does NOT exist, `dist/manifest.webmanifest` does NOT exist, `dist/index.html` exists, `dist/assets/` exists.

Re-run `bun run build` afterward so `dist/` reflects the normal web build before any subsequent task does anything sync-related.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json
git commit -m "$(cat <<'EOF'
build: gate VitePWA off for the iOS Capacitor build

Adds `bun run build:ios` (= `vite build --mode capacitor`) which skips the
VitePWA plugin entirely. Service workers don't register on capacitor://
custom schemes in WKWebView, so shipping the SW inside the iOS bundle is
either pointless (silent no-op) or actively harmful (stale cache masking
cap sync updates).
EOF
)"
```

---

## Task 9: Initialize Capacitor config

**Files:**
- Create: `capacitor.config.ts`

- [ ] **Step 1: Write the config file directly**

`bunx cap init` is interactive; write the config file directly to avoid the prompt.

Create `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dionco.liftbuddy',
  appName: 'Lift Buddy',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    // The Vite/React CSS already handles padding via env(safe-area-inset-*).
  },
};

export default config;
```

- [ ] **Step 2: Verify the config is recognized**

Run: `bunx cap doctor`

Expected output includes:

```
💊  Capacitor Doctor  💊

Latest Dependencies:
  @capacitor/cli: 6.x.x
  @capacitor/core: 6.x.x
  @capacitor/ios: 6.x.x

Installed Dependencies:
  @capacitor/cli: ✅ ...
  @capacitor/core: ✅ ...
  @capacitor/ios: ✅ ...
```

iOS may be reported as not installed yet — that's the next task.

- [ ] **Step 3: Commit**

```bash
git add capacitor.config.ts
git commit -m "$(cat <<'EOF'
chore: add capacitor.config.ts

appId is com.dionco.liftbuddy; webDir points at Vite's dist output. The
iOS bundle ID is fixed at config time and matches the spec for the
upcoming Live Activity feature.
EOF
)"
```

---

## Task 10: Add the iOS platform

**Files:**
- Create: `ios/` (entire directory tree, generated)
- Modify: `.gitignore`

- [ ] **Step 1: Prereq — CocoaPods**

`bunx cap add ios` runs `pod install` internally. Verify CocoaPods is installed:

Run: `pod --version`

If missing: `brew install cocoapods` (or `gem install cocoapods` with sudo, depending on your Ruby setup).

- [ ] **Step 2: Build the iOS web bundle first**

`bunx cap add ios` requires `webDir` (`dist/`) to exist.

Run: `bun run build:ios`

Expected: Vite outputs to `dist/` without errors and **without** `sw.js`/`registerSW.js`/`manifest.webmanifest`. Confirm `ls dist/index.html` succeeds.

- [ ] **Step 3: Add the iOS platform**

Run: `bunx cap add ios`

Expected output ends with:

```
✔ Adding native xcode project in ios in ...
✔ Copying web assets from dist to ios/App/App/public in ...
✔ Creating capacitor.config.json in ios/App/App in ...
✔ copy ios in ...
✔ update ios in ...
[info] Sync finished in ...
```

A new `ios/` directory now exists with `App/`, `App.xcodeproj`, `Podfile`, and supporting files. `ios/App/Pods/` is created by `pod install`.

- [ ] **Step 4: Update .gitignore**

Append to `.gitignore`:

```
# Capacitor iOS — synced web bundle (regenerated by `bunx cap sync`)
ios/App/App/public/
# Xcode build output
ios/DerivedData/
ios/App/Pods/
ios/App/App.xcworkspace/xcuserdata/
ios/App/App.xcodeproj/xcuserdata/
ios/App/App.xcodeproj/project.xcworkspace/xcuserdata/
```

- [ ] **Step 5: Run cap sync to confirm the loop**

Run: `bunx cap sync ios`

Expected: completes without errors, copies `dist/` into `ios/App/App/public/`.

- [ ] **Step 6: Commit**

```bash
git add ios .gitignore
git commit -m "$(cat <<'EOF'
feat(ios): add Capacitor iOS platform

`bunx cap add ios` generates the Xcode project tree at ios/. The synced
web bundle (ios/App/App/public/), Pods/, and Xcode user state are
gitignored.
EOF
)"
```

---

## Task 11: Configure `Info.plist` and set the iOS deployment target

**Files:**
- Modify: `ios/App/App/Info.plist`
- Modify: `ios/App/App.xcodeproj/project.pbxproj` (via Xcode UI)

- [ ] **Step 1: Add `NSSupportsLiveActivities`**

Open `ios/App/App/Info.plist`. Inside the top-level `<dict>`, add:

```xml
<key>NSSupportsLiveActivities</key>
<true/>
```

This is the only Info.plist key required for ActivityKit. `com.apple.developer.live-activities` is **not** a real entitlement name (confirmed by Apple DTS); there is no separate `.entitlements` file for Live Activities.

- [ ] **Step 2: Register the `liftbuddy://` URL scheme**

In the same `<dict>`, add:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.dionco.liftbuddy</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>liftbuddy</string>
    </array>
  </dict>
</array>
```

The scheme is declared now so Plan B's deep-link handler has it registered the day it lands.

- [ ] **Step 3: Verify Info.plist is still valid XML**

Run: `plutil -lint ios/App/App/Info.plist`

Expected: `ios/App/App/Info.plist: OK`

- [ ] **Step 4: Set the iOS deployment target to 17.0**

Open the Xcode workspace:

Run: `bunx cap open ios`

In Xcode:

1. Select the `App` project in the Project Navigator (top of the tree).
2. **Project-level setting:** select the project (not the target). Build Settings → search "deployment target" → set `iOS Deployment Target` to `17.0`.
3. **App target setting:** select the `App` target. General → Minimum Deployments → iOS `17.0`.

iOS 17.0 keeps Plan B's widget code free of `if #available` guards while comfortably running on iPhone 14 Pro (iOS 26.4.2).

- [ ] **Step 5: Commit**

```bash
git add ios/App/App/Info.plist ios/App/App.xcodeproj/project.pbxproj
git commit -m "$(cat <<'EOF'
feat(ios): declare Live Activity support, URL scheme, and deployment target

NSSupportsLiveActivities is the only Info.plist key needed for ActivityKit.
The liftbuddy:// URL scheme is declared now so Plan B's deep-link handler
has the scheme registered the day it lands. Deployment target is iOS 17.0
to keep Plan B's widget code free of `if #available` branches.
EOF
)"
```

---

## Task 12: First Simulator boot — verify the web UI loads in WKWebView

**Files:** (none modified in this task)

- [ ] **Step 1: Open the Xcode workspace**

If not already open: `bunx cap open ios`

Project Navigator on the left shows `App` with `App` as the main target.

- [ ] **Step 2: Select a Dynamic Island-capable Simulator**

In Xcode's top toolbar, click the device dropdown and pick `iPhone 15 Pro` or `iPhone 16 Pro` (any "Pro" model — Dynamic Island only renders on Pro hardware/Simulator).

- [ ] **Step 3: Set the signing team**

Select the `App` target → Signing & Capabilities tab → Team dropdown → pick your free "Personal Team" (your Apple ID auto-listed if signed in under Xcode Settings → Accounts).

Bundle ID stays `com.dionco.liftbuddy` (personal use, no fleet, no collisions expected).

- [ ] **Step 4: Build and run**

⌘R or click the Play button (▶).

Expected: Simulator boots, launches "Lift Buddy", and the app shows the same UI as `bun run dev` — the Train tab with the docket. The Dynamic Island region at the top of the Simulator is visible but currently empty (no Live Activity yet — that's Plan B).

If the WebView shows a white screen:
1. Check the Xcode console — service-worker registration errors should NOT appear (Task 8 gated them off). If they do appear, you ran `bun run build` instead of `bun run build:ios` before sync.
2. Re-run `bun run build:ios && bunx cap sync ios` and rebuild in Xcode.

- [ ] **Step 5: Smoke-test the in-app flows**

In the Simulator:
1. Start a session.
2. Log a set with the on-screen numpad → confirm rest pill begins counting down immediately (auto-start working).
3. Tap the running rest pill → confirm it skips back to idle.
4. Tap the idle pill → confirm it starts a fresh rest at the last-suggested duration.
5. Confirm cancel/finish flow works.

- [ ] **Step 6: Run the web build to confirm no regression**

Back at the terminal:

Run: `bun run dev`

Open `http://localhost:8080`. Confirm the web app loads identically and that VitePWA's service worker still registers in DevTools → Application → Service Workers. Stop the dev server.

Run: `bun run build`

Expected: production build succeeds; `dist/sw.js` and `dist/manifest.webmanifest` are present (the regular web build keeps VitePWA enabled).

- [ ] **Step 7: No commit yet**

Verification only. If issues turned up, fix and commit them as follow-ups before moving on.

---

## Task 13: Document iOS commands in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add iOS commands and architecture notes**

In `CLAUDE.md`, find the `## Commands` block and add after the existing single-test command:

```markdown
### iOS (Capacitor)

```bash
bun run build:ios                       # Web build with VitePWA gated off (mode=capacitor)
bun run build:ios && bunx cap sync ios  # Sync the latest web bundle into ios/App/App/public/
bunx cap open ios                       # Open the Xcode workspace
bunx cap run ios                        # Build + run on the default simulator
```

The iOS shell is generated by Capacitor and lives at `ios/`. The Vite build with `--mode capacitor` (= `bun run build:ios`) is the source of truth for the iOS bundle; `cap sync` copies it into the WebView container. `ios/App/App/public/` is gitignored — it's a build artifact.

The regular `bun run build` (used by Vercel) keeps VitePWA enabled and ships a service worker; `bun run build:ios` skips VitePWA because service workers don't register on the `capacitor://` custom scheme inside WKWebView.

iOS deployment target: **17.0**. Signing uses a free Apple Developer "Personal Team"; the 7-day provisioning expiry means the app needs a reinstall about once a week unless you upgrade to a paid Developer Program account. Personal-use scope — no App Store distribution planned.
```

Also append to `## Architecture`:

```markdown
**iOS shell** — `ios/` contains a Capacitor-generated Xcode project that hosts the Vite web build (built with `--mode capacitor` to skip VitePWA) inside a WKWebView. The web app runs identically whether served by Vite locally, deployed to Vercel (with PWA + SW), or running inside the iOS shell (no PWA). Native features (the Dynamic Island Live Activity in particular) are added via custom Capacitor plugins under `ios/App/App/`.
```

- [ ] **Step 2: Verify CLAUDE.md is still valid Markdown**

Eyeball the file. No specific check beyond that.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): document iOS Capacitor commands and shell architecture

Adds the bun-flavored cap commands (incl. build:ios for the SW-gated
Capacitor build) and notes the dist→ios/App/App/public sync flow so
future agents understand the build pipeline.
EOF
)"
```

---

## Plan A — Done. Verification gate before Plan B.

Before starting Plan B (the Live Activity feature itself), verify the foundation holds:

- [ ] `bun run dev` boots the web app at `localhost:8080`; rest timer auto-starts on set completion, tap skips, idle-tap restarts. Un-toggle a completed set → rest keeps running.
- [ ] `bun run build` produces a clean `dist/` with `sw.js` and `manifest.webmanifest` (PWA enabled).
- [ ] `bun run build:ios` produces a clean `dist/` **without** `sw.js`/`manifest.webmanifest` (PWA gated).
- [ ] `bunx vitest run` passes — including the new `restTimerStore.test.ts` (11 tests).
- [ ] `bunx cap sync ios && bunx cap open ios` opens Xcode without errors.
- [ ] Building the App target in Xcode and running on iPhone 15 Pro Simulator produces an app that shows the same UI as the web build. No service-worker registration errors in Xcode console.
- [ ] `git log --oneline -15` shows 12 new commits in a clean linear history; no merge conflicts.

If any of those fail, fix before moving on. Plan B assumes this foundation.
