# Active Workout — Reorder Exercises

**Status**: Design approved, ready for implementation plan
**Date**: 2026-05-25
**Scope**: Active session only; program/template order is untouched.

## Goal

Let the lifter re-order the exercises in the currently-active session via long-press + drag on the exercise card header. The new order persists with the session when finished and is reflected in history.

## Non-goals

- Editing program/template exercise order (the template is unchanged — reorder is a per-session view).
- Reordering sets within an exercise (sets still keep tap-to-focus and swipe-to-delete).
- Keyboard accessibility this iteration. The app is a mobile-only PWA; desktop is not a target.
- A "reorder mode" toggle, kebab actions, or always-visible grip handle. Long-press on the header is the single, discoverable gesture.

## Interaction model

State machine for one card's gesture:

```
idle ── pointerdown on .eb2-head ──► armed (350ms timer running)
armed ── move >8px before timeout ──► idle  (user was scrolling/tapping)
armed ── pointerup before timeout ──► idle  (regular tap on header — no-op)
armed ── timer fires (still on header, no move) ──► dragging
                                                     │
                                                     ├── pointermove ──► translateY the dragged card, displace siblings as midpoints cross
                                                     ├── pointer near top/bottom edge ──► autoscroll ses-stack
                                                     └── pointerup ──► commit reorder, snap-drop, exit dragging
```

On entering `dragging`:

- `setPointerCapture(pointerId)` on the card root.
- `navigator.vibrate(8)` — quietly ignored on iOS Safari, works on Android/Chrome.
- Numpad closes (`setActive(null)`).
- Add `is-reordering` class to `.ses-stack` so dimming applies and sibling gestures (set-row tap) become inert.

On `pointerup`:

- `navigator.vibrate(12)`.
- If target index === original index → snap back, no store mutation.
- Otherwise → call `reorderExercises(fromIndex, toIndex)`. 180ms snap as the dropped card settles into its new slot (which is supplied by the rebuild from the store).

## Data model & store

### New `id` field on `ExerciseLog`

```ts
export interface ExerciseLog {
  id: string;          // NEW — stable per-log identity, used as React key
  exercise: Exercise;
  sets: SetLog[];
}
```

This is required for the drag visual to look right: `ExerciseBlock`s use `key={log.id}` so React moves DOM nodes when the array reorders instead of reusing nodes by slot. Without it, the dragged card's `transform: scale(1.02) translateY(...)` would stay on the slot's DOM node and the swap would cause a one-frame visual mismatch (e.g. lift styles on the wrong exercise).

`exercise.id` alone is not unique within a session — the same lift can appear twice on one day (e.g. ascending-triples + back-off), so we need a per-log id.

Generation:

- `startSession`: assign `id: 'log-<crypto.randomUUID-or-Date.now-counter>'` to every log it constructs.
- `addExercise`: assign an `id` to the new log before pushing into `activeSession.exercises`.
- Persist-rehydrate path: in Zustand's `onRehydrateStorage`, walk `activeSession?.exercises` and any logs in `sessions[]` and backfill `id` if missing. This keeps existing persisted sessions valid without a forced migration version bump.

### New store action

```ts
reorderExercises: (fromIndex: number, toIndex: number) => void
```

Implementation: splice-move on `activeSession.exercises`, persisted automatically by the existing `persist` middleware. No-op if `fromIndex === toIndex` or either is out of bounds.

### How this fits existing invariants

- **ADR-0012** (diff consumes prescriptions in order): unaffected. `buildInitial` matches log → prescription by `exercise.id` with a `consumed` set, which is position-independent for distinct exercises. Duplicates of the same exercise within a single day are still consumed left-to-right in the program-day order; reordering the *log* array does not change which prescription a log slot matches.
- **ADR-0005** (sessions record reality): consistent. `set.timestamp` carries true chronology of when each set was logged; the exercise-array order is the lifter's chosen view of the session and is what's saved into `sessions[]` at finish.
- **`exId` = array index**: after reorder, every UI exercise gets a new `exId`. Local UI state in `ActiveWorkout` already rebuilds from the store fingerprint; we change the fingerprint to use the new per-log `id` (`activeSession.exercises.map(e => e.id).join('|')`) so reorder triggers a rebuild and indices realign. The new `UIExercise` shape carries `uiKey: string` (the log id), used as the React key in the `.map` over exercises.

## Component changes

**`src/types/training.ts`** — add required `id: string` to `ExerciseLog`.

**`src/store/useTrainingStore.ts`**:

- Add `reorderExercises(fromIndex, toIndex)`. Bounds-check; no-op if `from === to` or out of range.
- `startSession`: assign `id` to every constructed `ExerciseLog`.
- `addExercise`: assign `id` before pushing.
- `onRehydrateStorage`: backfill `id` on any persisted log missing one (active + history).

**`src/components/ActiveWorkout.tsx`** — small additions:

- Use new `useReorderableStack` hook to own gesture state. It returns a ref to attach to `.ses-stack` plus per-card props.
- `ExerciseBlock` gets a new `dragHandleProps` prop spread onto `.eb2-head` (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `ref`).
- `ExerciseBlock` accepts `isDragging` and `dragOffset` (in px) to apply the lift transform.
- The `.map` over exercises uses `key={ex.uiKey}` (the log id), not `key={ex.exId}`. This is what makes React move DOM nodes on reorder instead of reusing them by slot.
- On drag-start, the hook calls back to `ActiveWorkout` so it can `setActive(null)`.

**New file `src/hooks/useReorderableStack.ts`** — encapsulates the long-press → drag → drop state machine. Keeps `ActiveWorkout` from ballooning further. Signature:

```ts
function useReorderableStack(opts: {
  itemCount: number;
  onReorder: (from: number, to: number) => void;
  onDragStart?: () => void;
  longPressMs?: number;       // default 350
  cancelMoveThreshold?: number; // default 8
  autoscrollEdge?: number;    // default 80
}): {
  stackRef: RefObject<HTMLDivElement>;
  getCardProps(index: number): {
    ref: (el: HTMLDivElement | null) => void;
    dragHandleProps: HTMLAttributes<HTMLDivElement>;
    isDragging: boolean;
    displacement: number; // px translateY to apply
  };
};
```

**`src/index.css`** (or wherever the existing `.eb2` styles live) — three new classes:

- `.eb2.is-dragging` — `transform: scale(1.02) translateY(var(--drag-y)); box-shadow: 0 12px 32px rgba(0,0,0,.15); z-index: 5; transition: transform 120ms ease-out;` (drag-y is updated inline by JS; transition is suppressed during drag and re-enabled on release.)
- `.eb2.is-displaced` — `transition: transform 180ms ease-out;` (applied to siblings that slide out of the way.)
- `.ses-stack.is-reordering .eb2:not(.is-dragging)` — `opacity: 0.6;` (dim siblings while a card is in flight.)

## Drag mechanics

**Long-press detection.** A `setTimeout(longPressMs)` started on pointerdown, cancelled on pointerup or pointermove > `cancelMoveThreshold` (default 8px). The 8px tolerance allows tiny finger jitter while pressed.

**Coexistence with `Swipeable`.** Each exercise card is wrapped in `Swipeable`, which reads horizontal motion to trigger swipe-to-delete. Swipeable already classifies the first >8px of motion as `'horizontal' | 'vertical'`; vertical motion makes it stand down for the rest of the gesture (`handlePointerMove` returns early on line 70). So once the long-press fires and the user drags vertically, Swipeable harmlessly opts out. Pointer events still bubble through Swipeable's listeners but it ignores them. No locking API needed.

**Displacement during drag.** At drag-start, snapshot every card's bounding rect (top, height, midpoint Y). On each pointermove, compute the dragged card's current centre Y; find the slot whose midpoint range that centre falls into. For each non-dragged card whose original position is *between* the source and target slots, apply `transform: translateY(±cardHeight + gap)` so the row makes space at the target. Apply via inline style, with the `.is-displaced` class providing the transition.

**Autoscroll.** An rAF loop runs only while `dragging`. When pointer Y is within `autoscrollEdge` px (default 80) of `ses-stack`'s top or bottom, scroll by `±maxSpeed * (1 - distance / edge)` per frame, with `maxSpeed = 8`. Stop the loop on `dragging = false` or when the scroll position is clamped at the extreme.

**Commit.** On pointerup, call `onReorder(originalIndex, targetIndex)` (which `ActiveWorkout` forwards to `reorderExercises`). The Zustand update propagates to `activeSession.exercises`, the fingerprint-watching `useEffect` rebuilds `exercises` in the new order, and the dragged card's transform is reset by the rebuild (it's now at its new array position with `translateY(0)`).

## Edge cases

| Case | Behaviour |
|---|---|
| Drop on original position | No-op. Don't call `reorderExercises`. Card transform resets to 0 with the 180ms snap. |
| Numpad open when long-press fires | Numpad closes (`setActive(null)`) on drag-start; drag proceeds. |
| Pointer cancelled mid-drag (system gesture, phone notification overlay) | Treat as drop-on-original. Reset transforms, no commit. |
| Card with completed sets | Movable. ADR-0005 stands — `set.timestamp` is authoritative for chronology. |
| Only one exercise in the session | Long-press still arms but drop-on-original is the only outcome. Harmless. |
| Session finishes mid-drag | Not engineered for. Finish button is in the top bar and pointer capture during drag prevents it from being tapped. |
| Long-press fires, then user lifts finger without moving | Drop-on-original. No-op. Acts as a "preview lift" — fine. |

## Testing

Vitest unit tests in `src/test/`:

- `reorderExercises` store action:
  - Move first → last in a 4-exercise session.
  - Move last → first.
  - Move middle (index 1) → adjacent (index 2).
  - Same index from → to: no mutation.
  - Out-of-range from or to: no mutation.
- `ExerciseLog.id` generation:
  - `startSession` assigns a unique `id` to each constructed log.
  - `addExercise` assigns an `id` before pushing.
  - Rehydration backfills `id` on logs missing one (simulate persisted state with no `id` fields, hydrate, assert all logs have ids and ids are unique within their session).
- Order persists through `finishSession`: start a session, reorder, finish, assert the saved `Session` in `sessions[]` reflects the reordered array.

The gesture itself isn't unit-testable in the existing Vitest setup (no jsdom pointer-event emulator wired up). Manual smoke test on mobile during PR:

- Long-press a header → card lifts after 350ms with a haptic on Android.
- Drag up/down → siblings slide out of the way, dragged card follows finger.
- Approach top/bottom of viewport → ses-stack autoscrolls.
- Release on new slot → card snaps in, order persists; release on original slot → no change.
- Numpad open mid-set, long-press another exercise → numpad closes, drag activates.
- After reorder, history view shows the new order on the next `finishSession`.

## Open questions

None. All UX and implementation forks closed during brainstorming on 2026-05-25.
