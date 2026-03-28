# Add Exercise Sheet — Design Spec

**Date:** 2026-03-28
**Status:** Approved

## Summary

Make the "Add Exercise" button in `ActiveWorkout.tsx` functional. Opens a bottom sheet where the user can search, filter by muscle group, and select one or more exercises to add to the active workout session. Selections are persisted to the Zustand store.

## Scope

- New `AddExerciseSheet` component in `src/components/AddExerciseSheet.tsx`
- Minor changes to `ActiveWorkout.tsx` to wire the button and sheet
- No new data added — uses the existing 14 exercises from `EXERCISES` in `src/data/sampleProgram.ts`
- No equipment filter (out of scope for this iteration)
- "Add as Superset" rendered but disabled (placeholder)

## Component Structure & Data Flow

```
ActiveWorkout
  ├── showAddExercise: boolean  (new local state)
  ├── "Add Exercise" button → sets showAddExercise = true
  └── <AddExerciseSheet
        visible={showAddExercise}
        sessions={sessions}
        onClose={() => setShowAddExercise(false)}
        onAdd={(exercises) => { addExercise each via store; close sheet }}
      />
```

`AddExerciseSheet` internal state:
- `query: string` — search input value
- `muscleFilter: MuscleGroup | null` — active pill filter
- `selected: Set<string>` — selected exercise IDs

Data:
- Exercise list sourced directly from `EXERCISES` (imported)
- `usageCounts: Record<string, number>` derived via `useMemo` from `sessions` prop — counts how many sessions each exercise appears in
- Filtered list = `EXERCISES` values filtered by `query` (case-insensitive name substring) and `muscleFilter`, sorted descending by usage count

## Behaviour

- **Selection**: tap a row to toggle exercise in/out of `selected`. Multiple selection supported.
- **Add button**: disabled when `selected` is empty; label shows "Add Exercises (N)" when N ≥ 1. On tap: calls `addExercise` in Zustand store for each selected exercise (empty sets array), then closes sheet.
- **Add as Superset**: rendered, visually greyed out, no handler.
- **Search**: case-insensitive substring match on exercise name.
- **Muscle filter**: "All" + one pill per distinct muscle group in EXERCISES. Single selection; tapping active pill deselects (returns to All).
- **Sheet reset**: `query`, `muscleFilter`, and `selected` reset each time `visible` transitions false → true.
- **Portal**: rendered via `createPortal(…, document.body)` — same pattern as `Numpad`. `zIndex: 80` (above numpad's 70).

## Visual Design

Follows the existing design system in `ActiveWorkout.tsx`:

| Element | Style |
|---|---|
| Backdrop | `rgba(0,0,0,0.4)`, tap closes |
| Sheet | white, `border-radius: 16px 16px 0 0`, ~85vh, slides up via `translateY` |
| Transition | same cubic-bezier as Numpad: `0.22s cubic-bezier(0.4,0,0.2,1)` |
| Header | "Exercises" centered 16px 600, X button left |
| Search | `#F1EFE8` bg, `#D3D1C7` border, `border-radius: 10px`, magnifier icon |
| Filter pills | `#F1EFE8` default; active: `#7F77DD` bg + white text; `border-radius: 20px`; horizontal scroll, no scrollbar |
| Exercise row | Name `#2C2C2A` 14px 600; muscle group `#888780` 12px; usage count `#888780` 12px right-aligned; checkbox right-most (reuse `SetCheckbox`) |
| Selected row | `#F3F2FD` background tint |
| Footer | sticky, white bg, `border-top: 0.5px solid #D3D1C7`; "Add as Superset" outlined + "Add Exercises (N)" filled purple |

## Files Changed

| File | Change |
|---|---|
| `src/components/AddExerciseSheet.tsx` | New file |
| `src/components/ActiveWorkout.tsx` | Add `showAddExercise` state, wire button, render sheet |
