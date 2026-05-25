# Dynamic Island — Plan A: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap lift-buddy with Capacitor so it runs as a native iOS app loading the existing web UI in WKWebView, and move rest-timer state from `ActiveWorkout.tsx`'s local React state into the Zustand store (with a v8 migration). End state: web app behaves identically to before, iOS Simulator boots and shows the same UI, and the rest timer is store-backed so a later plan (Plan B) can mirror it into a Live Activity.

**Architecture:** Capacitor is added as a thin native shell — `bun run build` outputs to `dist/`, `bunx cap sync` copies that into `ios/App/App/public/`. The Vite/React source stays untouched. The rest-timer refactor swaps three `useState` hooks for two new Zustand actions (`startRest`, `endRest`) plus one new store field (`restEndsAt: number | null`), and deletes the dead `RestTimer.tsx` component.

**Tech Stack:** Vite 5, React 18.3, Zustand (persisted), TypeScript, Vitest+jsdom, Capacitor 6, iOS 16.4+ deployment target.

**Spec:** `docs/superpowers/specs/2026-05-25-dynamic-island-live-activity-design.md`

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `docs/adr/0014-rest-timer-state-in-store.md` | New | ADR for the rest-timer-in-store refactor |
| `src/store/useTrainingStore.ts` | Modify | Add `restEndsAt`, `startRest`, `endRest`; clear on session boundaries; v8 migration |
| `src/test/restTimerStore.test.ts` | New | Tests for the new store actions + v8 migration |
| `src/components/ActiveWorkout.tsx` | Modify | Replace `restRemaining`/`restRunning`/`restSuggested` `useState` with store-backed derivation |
| `src/components/RestTimer.tsx` | Delete | Dead code; never imported |
| `package.json` | Modify | Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` |
| `capacitor.config.ts` | New | Capacitor config: `appId`, `webDir`, server settings |
| `.gitignore` | Modify | Exclude `ios/App/App/public/` (sync artifact) + `ios/DerivedData/` |
| `ios/` | New (generated) | Full Xcode project tree from `bunx cap add ios` |
| `ios/App/App/Info.plist` | Modify | Add `NSSupportsLiveActivities=YES`, URL scheme `liftbuddy` |
| `CLAUDE.md` | Modify | Document iOS build commands and target structure |

---

## Task 1: ADR for moving rest timer state into the store

**Files:**
- Create: `docs/adr/0014-rest-timer-state-in-store.md`

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0014-rest-timer-state-in-store.md` with:

```markdown
# Rest timer state lives in the store, not in component-local state

The active session's rest-timer state — the absolute timestamp when the current rest ends — is held on the Zustand training store as `restEndsAt: number | null`, not as `useState` inside `ActiveWorkout.tsx`. `null` means "not resting"; a unix-ms timestamp means "rest expires at that instant". A small JS tick effect drives the on-screen countdown and calls `endRest()` to clear the field when the timestamp passes.

## Why

A future Live Activity / Dynamic Island feature (ADR-NNNN, spec dated 2026-05-25) needs to observe rest-timer state from a store subscriber that runs at the React tree root — outside `ActiveWorkout.tsx`. Component-local state isn't reachable from a top-level subscriber without prop-drilling or context, both of which couple the Live Activity bridge to the active-workout UI tree. Storing the absolute expiry timestamp also lets iOS render an OS-driven countdown via `Text(timerInterval:)` without our app ticking.

Storing the *absolute end timestamp* (not a remaining counter) means the value is correct across re-mounts and across the JS↔Swift bridge boundary: anyone with the timestamp can compute remaining at any moment. The store doesn't decrement; only `startRest` and `endRest` mutate it.

## Considered alternatives

**Keep rest state in `ActiveWorkout.tsx`, expose via context.** Adds a React context just for the bridge subscriber. The context provider would still have to live at the tree root. Net effect: same plumbing, plus the indirection of context — for no benefit.

**Store remaining seconds, decrement on a store-level tick.** Forces the store to schedule a recurring `set()` call. Works, but makes the store time-dependent (a `setInterval` lifetime tied to the store's lifetime) and gives downstream consumers a stale-by-design value (always 1 tick behind). The absolute-timestamp form is purely declarative.

## Consequences

- `restEndsAt` is cleared at any transition that ends the active session: `startSession`, `finishSession`, `cancelSession`. The invariant is: `restEndsAt !== null` implies `activeSession !== null`.
- The on-screen countdown in `ActiveWorkout.tsx` becomes derived: `remaining = Math.max(0, restEndsAt - now) / 1000`. A small `useEffect` drives a per-second re-render and calls `endRest()` at expiry.
- The dead `src/components/RestTimer.tsx` file is removed — it was never imported.
- Persisted v7 stores migrate to v8 with `restEndsAt: null`. No data is lost (no v7 store carried this field).
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/0014-rest-timer-state-in-store.md
git commit -m "$(cat <<'EOF'
docs(adr): rest timer state lives in the store, not component-local

Captures the rationale for moving rest-timer state out of ActiveWorkout's
useState into the Zustand store — needed for the upcoming Dynamic Island
Live Activity to observe rest state from a tree-root subscriber.
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
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTrainingStore } from '@/store/useTrainingStore';

describe('rest timer store slice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
    // Reset persisted state by clearing localStorage and re-hydrating
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
    const expected = Date.now() + 120_000;
    expect(useTrainingStore.getState().restEndsAt).toBe(expected);
  });

  it('endRest() clears restEndsAt to null', () => {
    useTrainingStore.getState().startRest(180);
    useTrainingStore.getState().endRest();
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });

  it('startRest with zero duration sets to now (immediate expiry)', () => {
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

Expected: 5 failures with errors like `TypeError: useTrainingStore.getState().startRest is not a function` and `expect(received).toBe(expected)` on the `null` baseline.

- [ ] **Step 3: Modify the store**

In `src/store/useTrainingStore.ts`, the `TrainingState` interface gets two new actions and one new field. The initial state object gets the field. Apply the following edits.

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
   *  or by the lifter tapping the rest pill mid-rest. */
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
    // Pre-seed an active session and a running rest
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
    // The case where a prior session ended without explicit cleanup somehow.
    useTrainingStore.setState({ activeSession: null, restEndsAt: 9999999999999 });
    useTrainingStore.getState().startSession('Test workout');
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: 3 new failures — the existing actions don't clear `restEndsAt`.

- [ ] **Step 3: Update the three actions**

In `src/store/useTrainingStore.ts`:

In `startSession`, after the `set({ activeSession: session });` line, change it to:

```ts
        set({ activeSession: session, restEndsAt: null });
```

In `finishSession`, find the final `set({...})` call (the one with `sessions: [finished, ...sessions], activeSession: null,`) and add `restEndsAt: null`:

```ts
        set({
          sessions: [finished, ...sessions],
          activeSession: null,
          restEndsAt: null,
        });
```

In `cancelSession`, change:

```ts
      cancelSession: () => set({ activeSession: null }),
```

to:

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

## Task 4: Bump persisted store to v8 with rest-timer migration

**Files:**
- Modify: `src/store/useTrainingStore.ts` (migrate() + version)
- Modify: `src/test/restTimerStore.test.ts`

- [ ] **Step 1: Write the failing test**

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
    const v8State = migrate(v7State, 7);
    expect(v8State.restEndsAt).toBeNull();
  });

  it('preserves a non-null restEndsAt that already exists (round-trip v8 → v8)', () => {
    const v8In = {
      sessions: [],
      program: { id: 'p', name: 'P', blocks: [], currentBlockIndex: 0, currentWeekIndex: 0, currentDayIndex: 0 },
      activeSession: null,
      restTimerDuration: 120,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,
      restEndsAt: 1234567890,
    };
    const v8Out = migrate(v8In, 8);
    expect(v8Out.restEndsAt).toBe(1234567890);
  });
});
```

Add the named import to the top of the test file:

```ts
import { useTrainingStore, migrate } from '@/store/useTrainingStore';
```

The `migrate` function is currently module-private — Step 3 will export it.

- [ ] **Step 2: Run, verify fail**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: the migration test fails because (a) `migrate` isn't exported and/or (b) the v8 block doesn't exist yet.

- [ ] **Step 3: Export `migrate` and add v8 block**

In `src/store/useTrainingStore.ts`:

Change `function migrate(...)` to `export function migrate(...)`.

After the v7 block in `migrate`, add:

```ts
  if (version < 8) {
    // v8: introduce `restEndsAt` per ADR-0014 (rest timer moves from
    // ActiveWorkout's component-local state into the store, so a future
    // Live Activity bridge can observe it from a tree-root subscriber).
    const s = state as TrainingState & { restEndsAt?: unknown };
    if (s.restEndsAt === undefined) s.restEndsAt = null;
  }
```

Change `version: 7,` in the `persist({...})` options to `version: 8,`.

- [ ] **Step 4: Run, verify pass**

Run: `bunx vitest run src/test/restTimerStore.test.ts`

Expected: 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/store/useTrainingStore.ts src/test/restTimerStore.test.ts
git commit -m "$(cat <<'EOF'
feat(store): bump persisted store to v8 for restEndsAt field

Existing v7 stores get restEndsAt: null on rehydrate. No data is lost
(v7 never carried this field). Migrate fn exported for direct testing.
EOF
)"
```

---

## Task 5: Refactor `ActiveWorkout.tsx` to use store-backed rest timer

**Files:**
- Modify: `src/components/ActiveWorkout.tsx` (rest-timer state block ~lines 1128-1144)

- [ ] **Step 1: Locate and read the current implementation**

The rest-timer state in `src/components/ActiveWorkout.tsx` is three `useState` hooks + a tick effect, currently around lines 1128-1144:

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

It's read by callers via `restRemaining`, `restRunning`, `restSuggested` and written via `setRestSuggested(rest); setRestRemaining(rest); setRestRunning(false)` (at lines 884-886 and 1076-1078) and via the `RestPill onToggle` callback (line 1252).

- [ ] **Step 2: Write the replacement block**

Replace the `// Manual rest timer.` block (the three `useState`s + the `useEffect`) with:

```ts
// Manual rest timer — backed by the store via restEndsAt (see ADR-0014).
// restRemaining and restRunning are derived; setRestRunning/setRestRemaining
// are kept as façades over startRest/endRest so the RestPill API is unchanged.
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

At line ~884 and line ~1077, the existing pattern is:

```ts
setRestSuggested(rest);
setRestRemaining(rest);
setRestRunning(false);  // manual start (the user must tap the pill to begin)
```

Change both occurrences to:

```ts
setRestSuggested(rest);
startRest(rest);  // Auto-start. Plan B's Live Activity transitions to the
                  // resting phase on set completion, so the timer needs to
                  // actually be running. Lifter can tap-to-skip via the pill.
```

This is a **deliberate UX change** from "load suggested time, lifter taps to start" to "start automatically on set completion." The spec's state machine (§State Machine in the design doc) treats the resting phase as a direct consequence of `updateSet({completed: true})`. The previous tap-to-start UX is replaced by tap-to-skip in the next step.

- [ ] **Step 4: Update the RestPill onToggle handler**

Around line 1247-1260 the current handler is:

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

This drops both the "pause/resume mid-rest" UX and the "load-but-don't-start" idle preview. With absolute-timestamp state, pause is meaningless. The simplification is intentional and matches the spec.

Smoke-test consequence to watch for in Step 6: after logging a set, the pill will be counting down immediately (because Step 3 auto-starts). The lifter no longer needs to tap to begin; tap is now skip.

- [ ] **Step 5: Run the full test suite**

Run: `bunx vitest run`

Expected: All existing tests pass. The new `restTimerStore.test.ts` tests pass. No regressions.

If the existing `restTimer.test.ts` (which tests `suggestRest`, not the UI) fails, something is wrong — that file tests pure functions and should be untouched.

- [ ] **Step 6: Smoke-test in the browser**

Run: `bun run dev`

Open `http://localhost:8080`. Start a session, log a set with the numpad, tap the rest pill. Confirm:
1. Pill goes from `REST` (idle) to a countdown with the suggested duration.
2. Countdown decrements once per second.
3. When it hits 0, the pill returns to the `REST` idle state.
4. Tapping again mid-countdown ends the rest (returns to idle).

If anything misbehaves, fix before committing.

- [ ] **Step 7: Commit**

```bash
git add src/components/ActiveWorkout.tsx
git commit -m "$(cat <<'EOF'
refactor(active-workout): back rest timer with the Zustand store

Replaces three useState hooks (restRemaining/restRunning/restSuggested) with
a store-backed derivation from restEndsAt. The pill's pause-mid-rest UX is
dropped; the spec considers tap-to-end + tap-to-restart equivalent and
simpler. Implements the ActiveWorkout side of ADR-0014.
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

Also run: `grep -rn "RestTimer" src/ --include="*.ts" --include="*.tsx"`

Expected: only the file itself (`src/components/RestTimer.tsx`) appears in matches; no other source references it. (The `restTimer.test.ts` file tests `lib/restTimer.ts` which is a different module — keep that.)

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

Run: `bun add @capacitor/core@^6 @capacitor/cli@^6 @capacitor/ios@^6`

Expected output includes `+ @capacitor/core@6.x`, `+ @capacitor/cli@6.x`, `+ @capacitor/ios@6.x` in the install log; `package.json` gets three new entries under `dependencies`.

Note: Capacitor 6 requires Node 18+. lift-buddy already runs on Node 20 (Vite 5 requirement), so this is fine. Capacitor 7 also works but pin to 6 for now — its `@capacitor/ios` 7 requires Xcode 15.4+; using 6 keeps the ceiling looser.

- [ ] **Step 2: Verify install integrity**

Run: `bunx cap --version`

Expected: prints a 6.x.x version.

Run: `bun run dev` (then Ctrl-C immediately)

Expected: Vite still boots without errors. Adding Capacitor packages to a Vite project shouldn't affect the web build.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock bun.lockb
git commit -m "$(cat <<'EOF'
chore: add Capacitor 6 core, cli, and iOS packages

First step toward wrapping lift-buddy as a native iOS app. The web build
keeps working unchanged; Capacitor only activates on `bunx cap sync` and
when running inside the iOS WebView.
EOF
)"
```

---

## Task 8: Initialize Capacitor config

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
    // Allow the WebView to use the full safe area; lift-buddy's CSS
    // already handles padding via env(safe-area-inset-*).
  },
};

export default config;
```

- [ ] **Step 2: Verify the config is recognized**

Run: `bunx cap doctor`

Expected output includes lines like:
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

## Task 9: Add the iOS platform

**Files:**
- Create: `ios/` (entire directory tree, generated)
- Modify: `.gitignore`

- [ ] **Step 1: Build the web bundle first**

`bunx cap add ios` requires `webDir` (`dist/`) to exist or it complains.

Run: `bun run build`

Expected: Vite outputs to `dist/` without errors. Confirm `ls dist/index.html` succeeds.

- [ ] **Step 2: Add the iOS platform**

Run: `bunx cap add ios`

Expected output ends with:
```
✔ Adding native xcode project in ios in ...
✔ add in ... in ...
✔ Syncing Gradle ... (skipped on iOS)
✔ copy ios in ...
✔ update ios in ...
[info] Sync finished in ...
```

A new `ios/` directory now exists at the repo root, containing `App/`, `App.xcodeproj`, `Podfile`, and supporting files.

- [ ] **Step 3: Update .gitignore**

Add the sync artifact and Xcode build output to `.gitignore`. Append these lines:

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

Note: `Pods/` is generated by CocoaPods on first build. We ignore it because Capacitor 6 manages dependencies via `Podfile` and developers regenerate locally.

- [ ] **Step 4: Run cap sync to confirm the loop works**

Run: `bunx cap sync ios`

Expected: completes without errors, copies `dist/` into `ios/App/App/public/`.

- [ ] **Step 5: Commit**

```bash
git add ios .gitignore
git commit -m "$(cat <<'EOF'
feat(ios): add Capacitor iOS platform

`bunx cap add ios` generates the Xcode project tree at ios/. The synced
web bundle (ios/App/App/public/) and Xcode build artifacts are gitignored.
EOF
)"
```

---

## Task 10: Configure `Info.plist` for Live Activity support and deep linking

**Files:**
- Modify: `ios/App/App/Info.plist`

- [ ] **Step 1: Add `NSSupportsLiveActivities`**

Open `ios/App/App/Info.plist`. Inside the top-level `<dict>`, add (alphabetical order or near other `NS*` keys is fine):

```xml
<key>NSSupportsLiveActivities</key>
<true/>
```

Per Apple's docs and the spec (§Architecture), this is the only entitlement required for ActivityKit — there is no separate `.entitlements` file needed for Live Activities. Quinn (Apple DTS) has explicitly confirmed `com.apple.developer.live-activities` is not a real entitlement name.

- [ ] **Step 2: Register the `liftbuddy://` URL scheme**

In the same `<dict>`, add (this will be consumed by Plan B's deep-link handler; declaring it now means the iOS app accepts the URL even before the handler exists):

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

- [ ] **Step 3: Verify Info.plist is still valid XML**

Run: `plutil -lint ios/App/App/Info.plist`

Expected: `ios/App/App/Info.plist: OK`

- [ ] **Step 4: Commit**

```bash
git add ios/App/App/Info.plist
git commit -m "$(cat <<'EOF'
feat(ios): declare Live Activity support and liftbuddy URL scheme

NSSupportsLiveActivities is the only Info.plist key needed for ActivityKit
(the "ActivityKit entitlement" is not a real entitlement — confirmed by
Apple DTS). The liftbuddy:// URL scheme is declared now so Plan B's
deep-link handler has the scheme registered the day it lands.
EOF
)"
```

---

## Task 11: First Simulator boot — verify the web UI loads in WKWebView

**Files:** (none modified in this task)

- [ ] **Step 1: Open the Xcode project**

Run: `bunx cap open ios`

Expected: Xcode launches and opens `ios/App/App.xcworkspace`. The Project Navigator on the left shows `App` with `App` as the main target.

- [ ] **Step 2: Select a Dynamic Island-capable Simulator**

In Xcode's top toolbar, click the device dropdown (next to the Play button) and pick `iPhone 15 Pro` or `iPhone 16 Pro` (any "Pro" model — Dynamic Island only renders on Pro hardware/Simulator).

- [ ] **Step 3: Set the signing team**

In Xcode: select the `App` target → Signing & Capabilities tab → Team dropdown → pick your free "Personal Team" (your Apple ID will be auto-listed if signed in to Xcode under Settings → Accounts).

If the Bundle Identifier is rejected ("already in use"), append a unique suffix locally — e.g., `com.dionco.liftbuddy.dev`. The Live Activity widget extension (Plan B) will pick this up; the production bundle id remains `com.dionco.liftbuddy`.

- [ ] **Step 4: Build and run**

Click the Play button (▶) in Xcode's toolbar, or press ⌘R.

Expected: the Simulator boots, launches "Lift Buddy", and the app shows the same UI as `bun run dev` produces in the browser — the Train tab with the docket. The Dynamic Island region at the top of the Simulator is visible but currently empty (no Live Activity yet — that's Plan B).

If the WebView shows a white screen, run `bunx cap sync ios` again (`dist/` may be stale) and rebuild.

- [ ] **Step 5: Smoke-test the in-app flows**

In the Simulator:
1. Start a session.
2. Log a set with the on-screen numpad.
3. Tap the rest pill → confirm countdown shows on the screen (this is the in-app rest timer, not yet a Live Activity).
4. Confirm cancel/finish flow works.

- [ ] **Step 6: Run the web build to confirm no regression**

Back at the terminal:

Run: `bun run dev`

Open `http://localhost:8080`. Confirm the web app loads identically and that the rest timer works. Stop the dev server.

Run: `bun run build`

Expected: production build succeeds with no warnings about Capacitor (Capacitor is a runtime-only dependency for iOS; Vite doesn't try to bundle it).

- [ ] **Step 7: No commit yet**

This task is verification only — nothing changed in the repo. If issues turned up, fix and commit them as a follow-up before moving on.

---

## Task 12: Document iOS commands in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add iOS commands and architecture notes**

In `CLAUDE.md`, find the `## Commands` block and add an `### iOS` subsection after the existing single-test command:

```markdown
### iOS (Capacitor)

```bash
bun run build && bunx cap sync ios    # Sync the latest web bundle into ios/App/App/public/
bunx cap open ios                     # Open the Xcode workspace
bunx cap run ios                      # Build + run on the default simulator
```

The iOS shell is generated by Capacitor and lives at `ios/`. The Vite build (`dist/`) is the source of truth; `cap sync` copies it into the iOS app's WebView container. `ios/App/App/public/` is gitignored — it's a build artifact.

iOS deployment target: 16.4+. Signing uses a free Apple Developer "Personal Team" by default; the 7-day provisioning expiry means the app needs a reinstall about once a week unless you upgrade to a paid Developer Program account.
```

Also append to the `## Architecture` section, a final paragraph:

```markdown
**iOS shell** — `ios/` contains a Capacitor-generated Xcode project that hosts the Vite web build inside a WKWebView. The web app runs identically whether served by Vite locally, deployed to Vercel, or running inside the iOS shell. Native features (the Dynamic Island Live Activity in particular) are added via custom Capacitor plugins under `ios/App/App/`.
```

- [ ] **Step 2: Verify CLAUDE.md is still valid Markdown**

Open in editor or run any preview tool to confirm formatting renders. No specific check beyond eyeballing.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): document iOS Capacitor commands and shell architecture

Adds the bun-flavored cap commands and notes the dist→ios/App/App/public
sync flow so future agents understand the build pipeline.
EOF
)"
```

---

## Plan A — Done. Verification gate before Plan B.

Before starting Plan B (the Live Activity feature itself), verify the foundation holds:

- [ ] `bun run dev` boots the web app at `localhost:8080`; rest timer works as before.
- [ ] `bun run build` produces a clean `dist/` with no warnings.
- [ ] `bunx vitest run` passes — including the new `restTimerStore.test.ts`.
- [ ] `bunx cap sync ios && bunx cap open ios` opens Xcode without errors.
- [ ] Building the App target in Xcode and running on iPhone 15 Pro Simulator produces an app that shows the same UI as the web build.
- [ ] `git log --oneline -15` shows 11 new commits in a clean linear history; no merge conflicts.

If any of those fail, fix before moving on. Plan B assumes this foundation.
