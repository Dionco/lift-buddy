# Active Workout — Reorder Exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lifters can long-press the header of any exercise card in the active session and drag to reorder. The new order persists with the saved session.

**Architecture:** Add a stable `id: string` to `ExerciseLog` (used as React key so DOM nodes track logs, not slots). Add a `reorderExercises(from, to)` store action that splice-moves `activeSession.exercises`. Encapsulate the long-press → drag → drop state machine in a new `useReorderableStack` hook backed by raw pointer events (matching the existing `Swipeable` style).

**Tech Stack:** React 18, TypeScript, Zustand with `persist` middleware, Vitest, plain CSS in `src/index.css`. Package manager is `bun`.

**Spec:** `docs/superpowers/specs/2026-05-25-active-workout-reorder-design.md`

---

## File map

- **Modify** `src/types/training.ts` — add required `id: string` to `ExerciseLog`.
- **Modify** `src/store/useTrainingStore.ts` — accept input shape without `id`, assign on entry; add `reorderExercises`; bump persist `version` to 8 with a migration that backfills `id` on existing persisted logs.
- **Modify** `src/components/ActiveWorkout.tsx` — switch React key to log id, change fingerprint to use log id, wire the new hook, thread drag props to `ExerciseBlock`, close numpad on drag start.
- **Create** `src/hooks/useReorderableStack.ts` — long-press, drag, displacement, autoscroll state machine.
- **Modify** `src/index.css` — three classes near the existing `.eb2` block.
- **Modify** `src/test/useTrainingStore.test.ts` — add tests for migration, id-on-insert, and `reorderExercises`.

---

## Task 1: Add stable `id` to `ExerciseLog`

**Files:**
- Modify: `src/types/training.ts:79-82`
- Modify: `src/store/useTrainingStore.ts:30-32, 252-261, 274-284, 126-238`
- Test: `src/test/useTrainingStore.test.ts`

The id is required by every later task. Type change first, then store input adapters, then migration backfill.

- [ ] **Step 1.1: Add the field to the type**

Edit `src/types/training.ts`:

```ts
export interface ExerciseLog {
  /** Stable per-log identity, assigned on creation. Used as React key so DOM
   *  nodes track logs across reorders rather than being reused by array slot.
   *  Per-log (not per-exercise) because the same exercise can appear twice
   *  in one day (e.g. ascending triples + back-off). */
  id: string;
  exercise: Exercise;
  sets: SetLog[];
}
```

- [ ] **Step 1.2: Add an input alias and update store signatures**

Edit `src/store/useTrainingStore.ts` near the top:

```ts
/** Input shape accepted by store actions that create exercise logs. The store
 *  assigns the per-log `id` internally — callers don't need to mint one. */
export type ExerciseLogInput = Omit<ExerciseLog, 'id'>;
```

Then update the `TrainingState` action signatures (around lines 30–32):

```ts
startSession: (workoutName?: string, programDayId?: string, exercises?: ExerciseLogInput[]) => void;
addExercise: (exerciseLog: ExerciseLogInput) => void;
```

- [ ] **Step 1.3: Add an id-generator helper at the top of the store file**

Edit `src/store/useTrainingStore.ts`, place near the other top-level helpers (above `migrate`):

```ts
let logIdCounter = 0;
/** Stable per-log id. Combines time + monotonic counter so multiple logs
 *  created within the same millisecond (e.g. when startSession spreads a
 *  prescribed day) still get distinct ids. */
function newLogId(): string {
  logIdCounter += 1;
  return `log-${Date.now().toString(36)}-${logIdCounter.toString(36)}`;
}
```

- [ ] **Step 1.4: Write the failing test for `startSession` assigning ids**

Add to `src/test/useTrainingStore.test.ts` (inside an appropriately-named `describe`):

```ts
describe('ExerciseLog.id (stable per-log identity)', () => {
  it('startSession assigns a unique id to every input log', () => {
    const exercises: ExerciseLogInput[] = [
      { exercise: squat, sets: [placeholder()] },
      { exercise: legPress, sets: [placeholder()] },
      { exercise: squat, sets: [placeholder()] }, // duplicate exercise on purpose
    ];
    useTrainingStore.getState().startSession('Test', 'day-1', exercises);
    const logs = useTrainingStore.getState().activeSession!.exercises;
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => typeof l.id === 'string' && l.id.length > 0)).toBe(true);
    const ids = new Set(logs.map((l) => l.id));
    expect(ids.size).toBe(3); // all unique, even for the duplicate exercise
  });
});
```

Make sure the test file imports `ExerciseLogInput`:

```ts
import { useTrainingStore, ExerciseLogInput } from '@/store/useTrainingStore';
```

- [ ] **Step 1.5: Run the test and confirm it fails**

```bash
bunx vitest run src/test/useTrainingStore.test.ts -t "startSession assigns a unique id"
```

Expected: FAIL because `startSession` doesn't yet assign ids (the type error blocking compilation is also acceptable as a "fail" — fix the input acceptance + id assignment together in 1.6).

- [ ] **Step 1.6: Update `startSession` to accept input shape and assign ids**

In `src/store/useTrainingStore.ts`, replace the body around lines 252–261:

```ts
startSession: (workoutName, programDayId, exercises) => {
  const stamped: ExerciseLog[] = (exercises ?? []).map((log) => ({
    ...log,
    id: newLogId(),
  }));
  const session: Session = {
    id: `session-${Date.now()}`,
    startTime: Date.now(),
    exercises: stamped,
    workoutName,
    programDayId,
  };
  set({ activeSession: session });
},
```

- [ ] **Step 1.7: Run the test and confirm it passes**

```bash
bunx vitest run src/test/useTrainingStore.test.ts -t "startSession assigns a unique id"
```

Expected: PASS.

- [ ] **Step 1.8: Write the failing test for `addExercise` assigning an id**

Add to the same `describe`:

```ts
it('addExercise assigns an id to the inserted log', () => {
  useTrainingStore.getState().startSession('Test', 'day-1', [
    { exercise: squat, sets: [placeholder()] },
  ]);
  useTrainingStore.getState().addExercise({ exercise: legPress, sets: [] });
  const logs = useTrainingStore.getState().activeSession!.exercises;
  expect(logs).toHaveLength(2);
  expect(typeof logs[1].id).toBe('string');
  expect(logs[1].id.length).toBeGreaterThan(0);
  expect(logs[1].id).not.toBe(logs[0].id);
});
```

- [ ] **Step 1.9: Run the test and confirm it fails**

```bash
bunx vitest run src/test/useTrainingStore.test.ts -t "addExercise assigns an id"
```

Expected: FAIL (or type error).

- [ ] **Step 1.10: Update `addExercise` to assign an id**

Replace the body around lines 274–284:

```ts
addExercise: (exerciseLog) => {
  const { activeSession } = get();
  if (activeSession) {
    set({
      activeSession: {
        ...activeSession,
        exercises: [
          ...activeSession.exercises,
          { ...exerciseLog, id: newLogId() },
        ],
      },
    });
  }
},
```

- [ ] **Step 1.11: Run the test and confirm it passes**

```bash
bunx vitest run src/test/useTrainingStore.test.ts -t "addExercise assigns an id"
```

Expected: PASS.

- [ ] **Step 1.12: Write the failing test for the v8 migration backfilling ids**

Add to the same `describe`:

```ts
it('v8 migration backfills ids on persisted logs that lack them', () => {
  // Simulate v7 persisted state: ExerciseLog with no `id` field.
  const v7State = {
    sessions: [
      {
        id: 'session-1',
        startTime: 1,
        endTime: 2,
        exercises: [
          { exercise: squat, sets: [logged(100, 5)] },
          { exercise: legPress, sets: [logged(200, 8)] },
        ],
      },
    ],
    activeSession: {
      id: 'session-2',
      startTime: 3,
      exercises: [{ exercise: squat, sets: [placeholder()] }],
    },
    program: useTrainingStore.getState().program,
    restTimerDuration: 120,
    trainingMaxes: null,
    loadingIncrement: 2.5,
    lastReadiness: null,
  };

  // Pull the migrate function out of the persist config and run it.
  const migrated = (useTrainingStore.persist.getOptions().migrate as
    | ((state: unknown, version: number) => unknown)
    | undefined)?.(v7State, 7) as typeof v7State;

  expect(migrated).toBeTruthy();
  expect(migrated.sessions[0].exercises.every((l: ExerciseLog) => typeof l.id === 'string' && l.id.length > 0)).toBe(true);
  expect(migrated.activeSession!.exercises.every((l: ExerciseLog) => typeof l.id === 'string' && l.id.length > 0)).toBe(true);

  const allIds = [
    ...migrated.sessions[0].exercises.map((l: ExerciseLog) => l.id),
    ...migrated.activeSession!.exercises.map((l: ExerciseLog) => l.id),
  ];
  expect(new Set(allIds).size).toBe(allIds.length); // all unique
});
```

- [ ] **Step 1.13: Run the test and confirm it fails**

```bash
bunx vitest run src/test/useTrainingStore.test.ts -t "v8 migration backfills ids"
```

Expected: FAIL — the migrate function does not yet handle v8.

- [ ] **Step 1.14: Add the v8 step to `migrate` and bump the persist version**

In `src/store/useTrainingStore.ts`, inside `migrate` (right after the v7 block at line 237), add:

```ts
if (version < 8) {
  // v8: stable per-log id on ExerciseLog so React keys identify logs (not
  // slots) during reorder. Backfill any persisted log that lacks one.
  const stamp = (logs: { id?: string }[] | undefined) => {
    if (!Array.isArray(logs)) return;
    for (const log of logs) {
      if (typeof log.id !== 'string' || log.id.length === 0) {
        log.id = newLogId();
      }
    }
  };
  if (Array.isArray(state.sessions)) {
    for (const s of state.sessions) stamp(s.exercises);
  }
  if (state.activeSession) stamp(state.activeSession.exercises);
}
```

Then change the persist config at the bottom of the file:

```ts
{
  name: 'training-store',
  version: 8,
  migrate: (persistedState, version) => migrate(persistedState, version),
}
```

- [ ] **Step 1.15: Run all tests in the file and confirm they pass**

```bash
bunx vitest run src/test/useTrainingStore.test.ts
```

Expected: all tests PASS, including the three new ones.

- [ ] **Step 1.16: Type-check the whole project**

```bash
bun run build
```

Expected: build succeeds. If anything fails because a caller (`TrainTab`, `AddExerciseSheet`) was passing an `ExerciseLog` and TypeScript now complains about the input shape — it should not, because `ExerciseLogInput = Omit<ExerciseLog, 'id'>` is structurally a supertype of `ExerciseLog`, so existing callers still satisfy it. If a real failure surfaces, fix that call site by passing the same fields minus `id`.

- [ ] **Step 1.17: Commit**

```bash
git add src/types/training.ts src/store/useTrainingStore.ts src/test/useTrainingStore.test.ts
git commit -m "$(cat <<'EOF'
feat(store): add stable id to ExerciseLog for stable React keys

Required for the upcoming reorder feature: React keys must identify
logs, not array slots, so DOM nodes track logs during reorder. v8
migration backfills ids on existing persisted state.
EOF
)"
```

---

## Task 2: Add `reorderExercises` store action

**Files:**
- Modify: `src/store/useTrainingStore.ts` (signature + implementation)
- Test: `src/test/useTrainingStore.test.ts`

- [ ] **Step 2.1: Write the failing tests**

Add to `src/test/useTrainingStore.test.ts`:

```ts
describe('reorderExercises', () => {
  function setupThree() {
    useTrainingStore.getState().startSession('Test', 'day-1', [
      { exercise: squat, sets: [placeholder()] },
      { exercise: legPress, sets: [placeholder()] },
      { exercise: squat, sets: [placeholder()] },
    ]);
    return useTrainingStore.getState().activeSession!.exercises.map((l) => l.id);
  }

  it('moves first to last', () => {
    const [idA, idB, idC] = setupThree();
    useTrainingStore.getState().reorderExercises(0, 2);
    const after = useTrainingStore.getState().activeSession!.exercises.map((l) => l.id);
    expect(after).toEqual([idB, idC, idA]);
  });

  it('moves last to first', () => {
    const [idA, idB, idC] = setupThree();
    useTrainingStore.getState().reorderExercises(2, 0);
    const after = useTrainingStore.getState().activeSession!.exercises.map((l) => l.id);
    expect(after).toEqual([idC, idA, idB]);
  });

  it('moves middle to adjacent', () => {
    const [idA, idB, idC] = setupThree();
    useTrainingStore.getState().reorderExercises(1, 2);
    const after = useTrainingStore.getState().activeSession!.exercises.map((l) => l.id);
    expect(after).toEqual([idA, idC, idB]);
  });

  it('is a no-op when from === to', () => {
    const before = setupThree();
    useTrainingStore.getState().reorderExercises(1, 1);
    const after = useTrainingStore.getState().activeSession!.exercises.map((l) => l.id);
    expect(after).toEqual(before);
  });

  it('is a no-op when either index is out of range', () => {
    const before = setupThree();
    useTrainingStore.getState().reorderExercises(-1, 2);
    expect(useTrainingStore.getState().activeSession!.exercises.map((l) => l.id)).toEqual(before);
    useTrainingStore.getState().reorderExercises(0, 99);
    expect(useTrainingStore.getState().activeSession!.exercises.map((l) => l.id)).toEqual(before);
  });

  it('is a no-op when there is no active session', () => {
    useTrainingStore.setState({ activeSession: null });
    useTrainingStore.getState().reorderExercises(0, 1);
    expect(useTrainingStore.getState().activeSession).toBeNull();
  });

  it('order persists through finishSession', () => {
    const [idA, idB, idC] = setupThree();
    // Mark all sets done so the logs aren't dropped by ADR-0005 normalisation.
    const exercises = useTrainingStore.getState().activeSession!.exercises;
    exercises.forEach((_, exIdx) => {
      useTrainingStore.getState().updateSet(exIdx, 0, {
        weight: 100, reps: 5, rpe: 8, completed: true, timestamp: Date.now(),
      });
    });
    useTrainingStore.getState().reorderExercises(0, 2);
    useTrainingStore.getState().finishSession();
    const saved = useTrainingStore.getState().sessions[0];
    expect(saved.exercises.map((l) => l.id)).toEqual([idB, idC, idA]);
  });
});
```

- [ ] **Step 2.2: Run the tests and confirm they fail**

```bash
bunx vitest run src/test/useTrainingStore.test.ts -t "reorderExercises"
```

Expected: FAIL — `reorderExercises is not a function`.

- [ ] **Step 2.3: Add the action signature to `TrainingState`**

In `src/store/useTrainingStore.ts`, near the other action signatures (~line 36):

```ts
removeExercise: (exerciseIndex: number) => void;
/** Move an exercise within the active session. No-op if from === to,
 *  either index is out of range, or there is no active session. */
reorderExercises: (fromIndex: number, toIndex: number) => void;
addSetToExercise: (exerciseIndex: number) => void;
```

- [ ] **Step 2.4: Implement the action**

Add inside the store factory, after `removeExercise` (around line 323):

```ts
reorderExercises: (fromIndex, toIndex) => {
  const { activeSession } = get();
  if (!activeSession) return;
  if (fromIndex === toIndex) return;
  const len = activeSession.exercises.length;
  if (fromIndex < 0 || fromIndex >= len) return;
  if (toIndex < 0 || toIndex >= len) return;
  const next = activeSession.exercises.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  set({ activeSession: { ...activeSession, exercises: next } });
},
```

- [ ] **Step 2.5: Run the tests and confirm they pass**

```bash
bunx vitest run src/test/useTrainingStore.test.ts -t "reorderExercises"
```

Expected: all 7 tests PASS.

- [ ] **Step 2.6: Run the full test file to confirm nothing else broke**

```bash
bunx vitest run src/test/useTrainingStore.test.ts
```

Expected: all PASS.

- [ ] **Step 2.7: Commit**

```bash
git add src/store/useTrainingStore.ts src/test/useTrainingStore.test.ts
git commit -m "$(cat <<'EOF'
feat(store): add reorderExercises action for active session

Splice-moves activeSession.exercises with bounds checks; no-op when
same index, out of range, or no active session.
EOF
)"
```

---

## Task 3: Surface log id through `ActiveWorkout`'s local UI state

**Files:**
- Modify: `src/components/ActiveWorkout.tsx:33-55` (UIExercise shape), `:67-160` (buildInitial), `:777-792` (fingerprint useEffect), `:1296-1305` (the .map keying)

After this task the UI still has no drag, but the component is ready: `key={ex.uiKey}` makes the React reconciler track logs by identity, and the fingerprint includes log ids so reorder triggers a clean rebuild.

- [ ] **Step 3.1: Add `uiKey` to `UIExercise`**

In `src/components/ActiveWorkout.tsx` around line 33, add the field at the top of the interface:

```ts
interface UIExercise {
  /** Log id from `ExerciseLog.id`. Used as the React key for the exercise
   *  map so DOM nodes follow logs across reorders rather than being reused
   *  by array slot (essential for the drag visual to look correct). */
  uiKey: string;
  exId: number;
  // ... rest unchanged
}
```

- [ ] **Step 3.2: Populate `uiKey` in `buildInitial`**

In `src/components/ActiveWorkout.tsx`, inside the `buildInitial` return statement (around line 111), add `uiKey` to the object literal:

```ts
return {
  uiKey: log.id,
  exId,
  exerciseId: log.exercise.id,
  // ... rest unchanged
};
```

- [ ] **Step 3.3: Change the fingerprint to use log id**

In `src/components/ActiveWorkout.tsx`, find the two fingerprint lines (around 778 and 782) and replace `e.exercise.id` with `e.id`:

```ts
const exerciseFingerprintRef = useRef(
  activeSession?.exercises.map((e) => e.id).join('|') ?? '',
);
useEffect(() => {
  if (!activeSession) return;
  const fingerprint = activeSession.exercises.map((e) => e.id).join('|');
  // ... rest unchanged
});
```

- [ ] **Step 3.4: Change the React key in the exercise `.map`**

In `src/components/ActiveWorkout.tsx`, find the `<Swipeable key={ex.exId}` (around line 1298) and change to:

```tsx
<Swipeable
  key={ex.uiKey}
  onDelete={onDelete}
  className="xb-swipe-shell"
  revealWidth={96}
>
```

- [ ] **Step 3.5: Run the type-check and existing component tests**

```bash
bun run build
bunx vitest run src/test/
```

Expected: build succeeds, all tests pass. No behaviour change yet — the UI looks identical; we've only changed reconciliation keys.

- [ ] **Step 3.6: Commit**

```bash
git add src/components/ActiveWorkout.tsx
git commit -m "$(cat <<'EOF'
refactor(active-workout): key exercise cards by log id, not slot

Required so the upcoming reorder gesture keeps the lift transform on
the dragged DOM node when the array order changes.
EOF
)"
```

---

## Task 4: Build the `useReorderableStack` hook

**Files:**
- Create: `src/hooks/useReorderableStack.ts`

The hook is non-trivial but self-contained. It owns the long-press timer, drag offset, sibling displacements, autoscroll loop, and pointer capture. Component callers see a stable API.

- [ ] **Step 4.1: Create the file with the hook signature**

Create `src/hooks/useReorderableStack.ts` with:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseReorderableStackOpts {
  /** Number of cards in the stack. Used to bounds-check drops. */
  itemCount: number;
  /** Called once on successful drop (target !== source). The hook does NOT
   *  call this for drop-on-same-position. */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Optional callback fired the moment a drag activates (after long-press
   *  timeout, before any movement). Callers use this to close any open
   *  numpad / dismiss focus. */
  onDragStart?: () => void;
  /** Long-press duration in ms before drag activates. Default 350. */
  longPressMs?: number;
  /** Movement (px) before long-press is cancelled (treated as scroll/tap).
   *  Default 8. */
  cancelMoveThreshold?: number;
  /** Distance from stack edge (px) at which autoscroll engages. Default 80. */
  autoscrollEdge?: number;
}

interface CardProps {
  /** Set this ref on the card root so the hook can measure rects at drag start. */
  ref: (el: HTMLDivElement | null) => void;
  /** Spread these on the press-target element (e.g. `.eb2-head`). */
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
  /** True for the card currently lifted. */
  isDragging: boolean;
  /** Px to translateY this card by (sibling displacement, or live drag offset
   *  for the dragged card). 0 when idle. */
  displacement: number;
}

interface UseReorderableStackResult {
  /** Attach to the scrollable stack element (e.g. `.ses-stack`). */
  stackRef: React.RefObject<HTMLDivElement>;
  /** True while a drag is active (use it to add `.is-reordering` to the stack). */
  isReordering: boolean;
  /** Returns drag-related props for the card at the given index. */
  getCardProps: (index: number) => CardProps;
}

export function useReorderableStack(
  opts: UseReorderableStackOpts,
): UseReorderableStackResult {
  throw new Error('not implemented');
}
```

- [ ] **Step 4.2: Implement the hook**

Replace the stub body of `useReorderableStack` with:

```ts
export function useReorderableStack(
  opts: UseReorderableStackOpts,
): UseReorderableStackResult {
  const {
    itemCount,
    onReorder,
    onDragStart,
    longPressMs = 350,
    cancelMoveThreshold = 8,
    autoscrollEdge = 80,
  } = opts;

  const stackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Mutable drag state lives in a ref so pointermove handlers don't restart
  // event listeners. React state mirrors only what the UI needs to render.
  const drag = useRef<{
    phase: 'idle' | 'armed' | 'dragging';
    sourceIndex: number;
    startY: number;
    pressTimer: number | null;
    rects: { top: number; height: number; mid: number }[];
    cardHeight: number;
    pointerId: number | null;
    autoscrollRaf: number | null;
    lastPointerY: number;
  }>({
    phase: 'idle',
    sourceIndex: -1,
    startY: 0,
    pressTimer: null,
    rects: [],
    cardHeight: 0,
    pointerId: null,
    autoscrollRaf: null,
    lastPointerY: 0,
  });

  // Renderable state: which card is dragging, current offset, and the
  // displacement map (index -> px translateY).
  const [draggingIndex, setDraggingIndex] = useState(-1);
  const [dragOffset, setDragOffset] = useState(0);
  const [displacements, setDisplacements] = useState<Record<number, number>>({});

  const clearPress = useCallback(() => {
    if (drag.current.pressTimer !== null) {
      window.clearTimeout(drag.current.pressTimer);
      drag.current.pressTimer = null;
    }
  }, []);

  const stopAutoscroll = useCallback(() => {
    if (drag.current.autoscrollRaf !== null) {
      cancelAnimationFrame(drag.current.autoscrollRaf);
      drag.current.autoscrollRaf = null;
    }
  }, []);

  const computeTargetIndex = useCallback((pointerY: number): number => {
    // Where the centre of the dragged card currently sits, projected onto the
    // original layout (we use the cached rects, not live DOM, so the moving
    // siblings don't confuse the math).
    const { rects, sourceIndex, startY } = drag.current;
    if (rects.length === 0) return sourceIndex;
    const sourceMid = rects[sourceIndex].mid;
    const draggedMid = sourceMid + (pointerY - startY);
    // First slot whose midpoint is past the dragged card's centre.
    for (let i = 0; i < rects.length; i++) {
      if (draggedMid < rects[i].mid) return i;
    }
    return rects.length - 1;
  }, []);

  const updateDisplacements = useCallback(
    (sourceIndex: number, targetIndex: number, cardHeight: number) => {
      const next: Record<number, number> = {};
      if (targetIndex === sourceIndex) {
        setDisplacements(next);
        return;
      }
      if (targetIndex > sourceIndex) {
        // Dragging downward: every card between source+1 and target shifts up.
        for (let i = sourceIndex + 1; i <= targetIndex; i++) {
          next[i] = -cardHeight;
        }
      } else {
        // Dragging upward: every card between target and source-1 shifts down.
        for (let i = targetIndex; i < sourceIndex; i++) {
          next[i] = cardHeight;
        }
      }
      setDisplacements(next);
    },
    [],
  );

  const runAutoscroll = useCallback(() => {
    const stack = stackRef.current;
    if (!stack || drag.current.phase !== 'dragging') {
      drag.current.autoscrollRaf = null;
      return;
    }
    const rect = stack.getBoundingClientRect();
    const y = drag.current.lastPointerY;
    let dy = 0;
    if (y < rect.top + autoscrollEdge) {
      const proximity = (rect.top + autoscrollEdge - y) / autoscrollEdge;
      dy = -8 * Math.min(1, Math.max(0, proximity));
    } else if (y > rect.bottom - autoscrollEdge) {
      const proximity = (y - (rect.bottom - autoscrollEdge)) / autoscrollEdge;
      dy = 8 * Math.min(1, Math.max(0, proximity));
    }
    if (dy !== 0) {
      stack.scrollBy({ top: dy, behavior: 'auto' });
      // Update the source rect baseline so the drag math stays consistent
      // with the scrolled viewport: shift startY by the same delta.
      drag.current.startY -= dy;
    }
    drag.current.autoscrollRaf = requestAnimationFrame(runAutoscroll);
  }, [autoscrollEdge]);

  const activateDrag = useCallback(
    (index: number, pointerId: number) => {
      const cards = cardRefs.current;
      if (cards.length === 0) return;
      const rects = cards.map((el) => {
        if (!el) return { top: 0, height: 0, mid: 0 };
        const r = el.getBoundingClientRect();
        return { top: r.top, height: r.height, mid: r.top + r.height / 2 };
      });
      const cardHeight =
        rects[index]?.height ||
        rects.find((r) => r.height > 0)?.height ||
        0;

      drag.current.phase = 'dragging';
      drag.current.rects = rects;
      drag.current.cardHeight = cardHeight;
      drag.current.pointerId = pointerId;

      setDraggingIndex(index);
      setDragOffset(0);
      setDisplacements({});

      if ('vibrate' in navigator) {
        try { navigator.vibrate(8); } catch { /* noop */ }
      }
      onDragStart?.();
      drag.current.autoscrollRaf = requestAnimationFrame(runAutoscroll);
    },
    [onDragStart, runAutoscroll],
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      const { sourceIndex, lastPointerY } = drag.current;
      stopAutoscroll();
      let targetIndex = sourceIndex;
      if (commit && drag.current.phase === 'dragging') {
        targetIndex = computeTargetIndex(lastPointerY);
      }
      drag.current.phase = 'idle';
      drag.current.pointerId = null;
      drag.current.rects = [];
      drag.current.cardHeight = 0;
      setDraggingIndex(-1);
      setDragOffset(0);
      setDisplacements({});
      if (commit && targetIndex !== sourceIndex) {
        if ('vibrate' in navigator) {
          try { navigator.vibrate(12); } catch { /* noop */ }
        }
        onReorder(sourceIndex, targetIndex);
      }
    },
    [computeTargetIndex, onReorder, stopAutoscroll],
  );

  // Clean up timers / RAFs on unmount.
  useEffect(() => {
    return () => {
      clearPress();
      stopAutoscroll();
    };
  }, [clearPress, stopAutoscroll]);

  const getCardProps = useCallback(
    (index: number): CardProps => {
      const isDragging = draggingIndex === index;
      const displacement = isDragging ? dragOffset : displacements[index] ?? 0;
      return {
        ref: (el) => {
          cardRefs.current[index] = el;
        },
        dragHandleProps: {
          onPointerDown: (e) => {
            // Only primary button / primary touch.
            if (e.button !== undefined && e.button !== 0) return;
            if (drag.current.phase !== 'idle') return;
            drag.current.phase = 'armed';
            drag.current.sourceIndex = index;
            drag.current.startY = e.clientY;
            drag.current.lastPointerY = e.clientY;
            drag.current.pressTimer = window.setTimeout(() => {
              drag.current.pressTimer = null;
              if (drag.current.phase !== 'armed') return;
              // Capture the pointer onto the card root so subsequent moves
              // route here even if the finger drifts off the header.
              const card = cardRefs.current[index];
              try { card?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
              activateDrag(index, e.pointerId);
            }, longPressMs);
          },
          onPointerMove: (e) => {
            drag.current.lastPointerY = e.clientY;
            if (drag.current.phase === 'armed') {
              const dy = Math.abs(e.clientY - drag.current.startY);
              if (dy > cancelMoveThreshold) {
                clearPress();
                drag.current.phase = 'idle';
              }
              return;
            }
            if (drag.current.phase !== 'dragging') return;
            if (drag.current.sourceIndex !== index) return;
            const offset = e.clientY - drag.current.startY;
            setDragOffset(offset);
            const target = computeTargetIndex(e.clientY);
            updateDisplacements(
              drag.current.sourceIndex,
              target,
              drag.current.cardHeight,
            );
          },
          onPointerUp: (e) => {
            if (drag.current.phase === 'armed') {
              clearPress();
              drag.current.phase = 'idle';
              return;
            }
            if (drag.current.phase !== 'dragging') return;
            try {
              cardRefs.current[index]?.releasePointerCapture?.(e.pointerId);
            } catch { /* noop */ }
            endDrag(true);
          },
          onPointerCancel: (e) => {
            if (drag.current.phase === 'armed') {
              clearPress();
              drag.current.phase = 'idle';
              return;
            }
            if (drag.current.phase !== 'dragging') return;
            try {
              cardRefs.current[index]?.releasePointerCapture?.(e.pointerId);
            } catch { /* noop */ }
            endDrag(false);
          },
        },
        isDragging,
        displacement,
      };
    },
    [
      draggingIndex,
      dragOffset,
      displacements,
      activateDrag,
      clearPress,
      computeTargetIndex,
      endDrag,
      cancelMoveThreshold,
      longPressMs,
      updateDisplacements,
    ],
  );

  // Trim card ref array if itemCount shrinks.
  useEffect(() => {
    cardRefs.current.length = itemCount;
  }, [itemCount]);

  return {
    stackRef,
    isReordering: draggingIndex !== -1,
    getCardProps,
  };
}
```

- [ ] **Step 4.3: Type-check**

```bash
bun run build
```

Expected: build succeeds. Fix any TypeScript errors before continuing.

- [ ] **Step 4.4: Commit**

```bash
git add src/hooks/useReorderableStack.ts
git commit -m "$(cat <<'EOF'
feat(hooks): add useReorderableStack for long-press drag-to-reorder

Pointer-event state machine: 350ms long-press arms; cancels on >8px
move; on activation lifts the card, autoscrolls near edges, and on
release commits the new order via onReorder.
EOF
)"
```

---

## Task 5: Wire the hook into `ActiveWorkout`

**Files:**
- Modify: `src/components/ActiveWorkout.tsx` (ExerciseBlock props, the stack render, numpad close on drag start)

- [ ] **Step 5.1: Extend `ExerciseBlockProps`**

In `src/components/ActiveWorkout.tsx` around line 556, add three new props:

```ts
interface ExerciseBlockProps {
  ex: UIExercise;
  active: ActiveInput | null;
  onFocus: (setId: string, field: 'weight' | 'reps') => void;
  onToggleDone: (setId: string) => void;
  onAddSet: () => void;
  onApplyTarget: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  /** Spread onto `.eb2-head` to enable long-press drag. */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  /** True for the currently-lifted card. */
  isDragging?: boolean;
  /** Px to translateY the whole card by (live drag offset for dragging card,
   *  sibling displacement otherwise). */
  displacement?: number;
  /** Ref forwarded to the card root for rect measurement. */
  cardRef?: (el: HTMLDivElement | null) => void;
}
```

- [ ] **Step 5.2: Apply the new props inside `ExerciseBlock`**

In `src/components/ActiveWorkout.tsx`, replace the `ExerciseBlock` return statement's root `<div>` and `.eb2-head` opening so they consume the new props. Find lines ~579-607 and replace:

```tsx
const rootStyle: React.CSSProperties | undefined = isDragging
  // Dragging: pass the live offset through a CSS variable so the `.is-dragging`
  // rule's `scale(1.02) translateY(var(--drag-y))` keeps both transforms.
  ? ({ ['--drag-y' as string]: `${displacement}px` } as React.CSSProperties)
  // Displacement (sibling): plain translateY, animated by the .eb2 base rule.
  : displacement !== 0
    ? { transform: `translateY(${displacement}px)` }
    : undefined;

return (
  <div
    ref={cardRef}
    className={`eb2 ${ex.isMainLift ? 'is-main' : ''} ${isCurrent ? 'is-current' : ''} ${isDragging ? 'is-dragging' : ''} ${!isDragging && displacement !== 0 ? 'is-displaced' : ''}`}
    style={rootStyle}
  >
    <div className="eb2-head" {...(dragHandleProps ?? {})}>
      <div className="eb2-head-l">
        <div className="eb2-eyebrow">
          {ex.isMainLift && <span className="tag">MAIN</span>}
          {ex.muscles.length > 0 && (
            <span className="mg">{ex.muscles.join(' · ').toUpperCase()}</span>
          )}
        </div>
        <div className="eb2-name">{ex.name}</div>
        {ex.prescription?.notes && (
          <div className="eb2-note">{ex.prescription.notes}</div>
        )}
      </div>
      {ex.prescription && (
        <span className="eb2-rx">
          {ex.prescription.sets}×{ex.prescription.reps}
          {ex.prescription.rpeTarget != null ? ` @${ex.prescription.rpeTarget}` : ''}
        </span>
      )}
      <button type="button" className="eb2-more" aria-label="More">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="2.5" cy="7" r="1" fill="currentColor" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
          <circle cx="11.5" cy="7" r="1" fill="currentColor" />
        </svg>
      </button>
    </div>
```

Also update the `ExerciseBlock` function signature to destructure the new props:

```tsx
function ExerciseBlock({
  ex,
  active,
  onFocus,
  onToggleDone,
  onAddSet,
  onApplyTarget,
  onDeleteSet,
  rowRefs,
  dragHandleProps,
  isDragging,
  displacement = 0,
  cardRef,
}: ExerciseBlockProps) {
```

- [ ] **Step 5.3: Use the hook in `ActiveWorkout`**

In `src/components/ActiveWorkout.tsx`, near the top of the component (after the other `useState` calls, around line 772), add:

```ts
const reorderExercisesInStore = useTrainingStore((s) => s.reorderExercises);

const { stackRef: reorderStackRef, isReordering, getCardProps } = useReorderableStack({
  itemCount: exercises.length,
  onReorder: (from, to) => reorderExercisesInStore(from, to),
  onDragStart: () => setActive(null),
});
```

Add the import at the top of the file:

```ts
import { useReorderableStack } from '@/hooks/useReorderableStack';
```

- [ ] **Step 5.4: Merge `reorderStackRef` with the existing `stackRef`**

The component already declares `const stackRef = useRef<HTMLDivElement>(null);` (around line 1100) and attaches it to `.ses-stack`. Replace that line with a small ref-bridge so both the existing scroll-into-view code and the hook see the same element:

```ts
const stackRef = useRef<HTMLDivElement>(null);
const setStackRef = useCallback((el: HTMLDivElement | null) => {
  stackRef.current = el;
  (reorderStackRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
}, [reorderStackRef]);
```

Then change the `.ses-stack` `ref={stackRef}` (around line 1265) to `ref={setStackRef}`.

Also add `is-reordering` to its className:

```tsx
<div
  className={`ses-stack ${isReordering ? 'is-reordering' : ''}`}
  ref={setStackRef}
  style={{ paddingBottom: active ? 520 : 96 }}
>
```

- [ ] **Step 5.5: Pass per-card drag props in the `.map`**

In `src/components/ActiveWorkout.tsx`, find the `exercises.map((ex) => {` block (around line 1268) and update the inner `ExerciseBlock` call. Replace the entire `const block = ( ... );` with:

```tsx
const cardProps = getCardProps(ex.exId);
const block = (
  <ExerciseBlock
    ex={ex}
    active={active}
    onFocus={(setId, field) => handleFocus(ex.exId, setId, field)}
    onToggleDone={(setId) => handleToggleDone(ex.exId, setId)}
    onAddSet={() => handleAddSet(ex.exId)}
    onApplyTarget={(setId) => handleApplyTarget(ex.exId, setId)}
    onDeleteSet={(setId) => handleDeleteSet(ex.exId, setId)}
    rowRefs={rowRefs}
    cardRef={cardProps.ref}
    dragHandleProps={cardProps.dragHandleProps}
    isDragging={cardProps.isDragging}
    displacement={cardProps.displacement}
  />
);
```

- [ ] **Step 5.6: Type-check and run tests**

```bash
bun run build
bunx vitest run src/test/
```

Expected: build succeeds, tests pass.

- [ ] **Step 5.7: Commit**

```bash
git add src/components/ActiveWorkout.tsx
git commit -m "$(cat <<'EOF'
feat(active-workout): wire long-press drag-to-reorder into exercise cards

Numpad closes when a drag activates; the stack gains an is-reordering
class so siblings dim while a card is in flight.
EOF
)"
```

---

## Task 6: Add CSS for lift / displacement / dim

**Files:**
- Modify: `src/index.css` (near the existing `.eb2` rules at line 3263)

- [ ] **Step 6.1: Add the three classes**

Open `src/index.css`, locate the existing `.eb2 {}` rule (around line 3263), and add the following block immediately after the existing `.eb2.is-main` / `.eb2.is-current` modifier lines (~line 3271):

```css
/* Reorder gesture states. See docs/superpowers/specs/2026-05-25-active-workout-reorder-design.md. */
.eb2 {
  /* `transform` is set inline during drag/displacement; this rule provides
     the baseline transition for the displacement slide. */
  transition: transform 180ms ease-out, opacity 120ms ease-out;
  touch-action: pan-y;
}
.eb2.is-displaced {
  /* explicit class kept for grep-ability; the transition lives on .eb2 above */
}
.eb2.is-dragging {
  transform: scale(1.02) translateY(var(--drag-y, 0px));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  z-index: 5;
  transition: none; /* live drag — no easing, follow the finger */
}
.ses-stack.is-reordering .eb2:not(.is-dragging) {
  opacity: 0.6;
}
```

Note: `.eb2.is-dragging` uses a CSS variable `--drag-y` for the live offset; Task 5.2 already sets that variable. Displaced siblings still use a plain inline `transform: translateY(...)`.

- [ ] **Step 6.2: Verify in dev**

Run the dev server:

```bash
bun run dev
```

Open the app on a phone (or device emulation), start a session with ≥ 2 exercises, long-press an exercise header. Expected:

- After ~350ms the card scales to 1.02 with a soft shadow, other cards dim to 60%.
- Dragging the card slides siblings out of the way smoothly.
- Approaching the top/bottom of the visible stack autoscrolls.
- Release on a new slot reorders; release on origin snaps back.

If anything visually wrong, fix in `src/index.css` or the inline style in `ExerciseBlock`. The hook itself shouldn't need changes for visual issues.

- [ ] **Step 6.3: Commit**

```bash
git add src/index.css src/components/ActiveWorkout.tsx
git commit -m "$(cat <<'EOF'
style(active-workout): add lift / displacement / dim styles for reorder

Dragged card scales + shadow + z-lift; siblings transition smoothly
when they slide out of the way; stack dims non-dragged cards while a
reorder is in progress.
EOF
)"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 7.1: Run lint, full test suite, and build**

```bash
bun run lint
bunx vitest run
bun run build
```

Expected: all green.

- [ ] **Step 7.2: Manual smoke test on a real device or device emulation**

Run `bun run dev`, open `http://localhost:8080`, start a session with at least 3 exercises, and walk through this checklist. Mark each item once verified:

- [ ] Long-press an exercise header → card lifts after ~350ms with haptic on Android (silent on iOS Safari but no error).
- [ ] Dragging up/down moves the dragged card; siblings slide out of the way.
- [ ] Dragging near the top of the stack autoscrolls upward; same near bottom.
- [ ] Releasing on a new slot reorders the array; releasing on the same slot snaps back without a store update.
- [ ] Open the numpad on a set, then long-press another exercise header → numpad closes, drag activates.
- [ ] Tapping a set row (not a long-press) still focuses the cell — no accidental drag.
- [ ] Swipe-left on an exercise still triggers delete — no collision with the new gesture.
- [ ] Finish the session → check History tab → exercise order on the saved session matches the reordered view.
- [ ] Refresh the page mid-session (forces rehydrate). The active session loads with all exercises having ids; long-press still works.

- [ ] **Step 7.3: No commit needed** — verification only. Push when ready:

```bash
git push
```

---

## Notes for the implementer

- The gesture interacts with the wrapping `Swipeable` (one per card) without locking. Swipeable classifies the first >8px of motion as horizontal or vertical; vertical motion makes it stand down. The long-press fires at zero motion, so by the time we activate, any subsequent vertical movement is correctly ignored by Swipeable.
- Pointer capture is set on the card root, not the header — this routes events to the captured element even if the finger drifts off the header bar mid-drag. Swipeable's listeners on the same DOM subtree still see the bubbled events but don't act on them.
- The store fingerprint-watching `useEffect` in `ActiveWorkout` rebuilds the local `exercises` array when the order changes. That's why no explicit "after-reorder UI sync" code is needed.
