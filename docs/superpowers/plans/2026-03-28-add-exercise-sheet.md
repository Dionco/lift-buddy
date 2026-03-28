# Add Exercise Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Add Exercise" button in `ActiveWorkout.tsx` open a bottom-sheet where the user can search, filter, multi-select exercises, and add them to the active workout (persisted to the Zustand store).

**Architecture:** A new `AddExerciseSheet` component renders via `createPortal` into `document.body` (same pattern as the existing `Numpad`). It receives `sessions` and `onAdd` as props, manages its own search/filter/selection state, and exposes a pure `computeUsageCounts` function for testability. `ActiveWorkout` wires the button, passes store actions via callbacks, and updates both local UI state and the Zustand store on confirm.

**Tech Stack:** React 18, TypeScript, Vitest + React Testing Library, Zustand, `createPortal`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/AddExerciseSheet.tsx` | **Create** | Sheet UI, search/filter/select logic, portal rendering |
| `src/test/AddExerciseSheet.test.tsx` | **Create** | Tests for `computeUsageCounts` and sheet behavior |
| `src/components/ActiveWorkout.tsx` | **Modify** | Wire "Add Exercise" button, render sheet, handle `onAdd` |

---

## Task 1: AddExerciseSheet — write failing tests

**Files:**
- Create: `src/test/AddExerciseSheet.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/test/AddExerciseSheet.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddExerciseSheet, computeUsageCounts } from '@/components/AddExerciseSheet';
import { Session } from '@/types/training';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockSession = (exerciseIds: string[]): Session => ({
  id: `s-${Math.random()}`,
  startTime: 0,
  exercises: exerciseIds.map((id) => ({
    exercise: { id, name: id, muscleGroup: 'Quads', isMainLift: false },
    sets: [],
  })),
});

function renderSheet(overrides: Partial<React.ComponentProps<typeof AddExerciseSheet>> = {}) {
  const onClose = vi.fn();
  const onAdd = vi.fn();
  render(
    <AddExerciseSheet
      visible={true}
      sessions={[]}
      onClose={onClose}
      onAdd={onAdd}
      {...overrides}
    />
  );
  return { onClose, onAdd };
}

// ─── computeUsageCounts ──────────────────────────────────────────────────────

describe('computeUsageCounts', () => {
  it('returns empty object for no sessions', () => {
    expect(computeUsageCounts([])).toEqual({});
  });

  it('counts one appearance per session per exercise', () => {
    const sessions = [
      mockSession(['squat', 'bench']),
      mockSession(['squat']),
    ];
    expect(computeUsageCounts(sessions)).toEqual({ squat: 2, bench: 1 });
  });

  it('does not include exercises that never appeared', () => {
    const counts = computeUsageCounts([mockSession(['squat'])]);
    expect(counts['deadlift']).toBeUndefined();
  });
});

// ─── AddExerciseSheet ─────────────────────────────────────────────────────────

describe('AddExerciseSheet', () => {
  it('renders the "Exercises" heading when visible', () => {
    renderSheet();
    expect(screen.getByText('Exercises')).toBeInTheDocument();
  });

  it('renders all 14 exercises', () => {
    renderSheet();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Deadlift')).toBeInTheDocument();
    expect(screen.getByText('Pull-ups')).toBeInTheDocument();
  });

  it('filters exercises by search query', async () => {
    renderSheet();
    await userEvent.type(screen.getByPlaceholderText('Search exercise name'), 'curl');
    expect(screen.getByText('Bicep Curl')).toBeInTheDocument();
    expect(screen.queryByText('Squat')).not.toBeInTheDocument();
  });

  it('filters exercises by muscle group pill', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Biceps' }));
    expect(screen.getByText('Bicep Curl')).toBeInTheDocument();
    expect(screen.queryByText('Squat')).not.toBeInTheDocument();
  });

  it('clicking active muscle group pill returns to "All"', async () => {
    renderSheet();
    const bicepsBtn = screen.getByRole('button', { name: 'Biceps' });
    await userEvent.click(bicepsBtn);
    await userEvent.click(bicepsBtn);
    expect(screen.getByText('Squat')).toBeInTheDocument();
  });

  it('shows "Add Exercises" (disabled) when nothing selected', () => {
    renderSheet();
    const addBtn = screen.getByRole('button', { name: 'Add Exercises' });
    expect(addBtn).toBeDisabled();
  });

  it('updates Add button label with count when exercises selected', async () => {
    renderSheet();
    await userEvent.click(screen.getByText('Squat'));
    expect(screen.getByRole('button', { name: 'Add Exercises (1)' })).toBeInTheDocument();
  });

  it('deselects exercise when tapped again', async () => {
    renderSheet();
    await userEvent.click(screen.getByText('Squat'));
    await userEvent.click(screen.getByText('Squat'));
    expect(screen.getByRole('button', { name: 'Add Exercises' })).toBeDisabled();
  });

  it('calls onAdd with the selected Exercise objects', async () => {
    const { onAdd } = renderSheet();
    await userEvent.click(screen.getByText('Squat'));
    await userEvent.click(screen.getByRole('button', { name: 'Add Exercises (1)' }));
    expect(onAdd).toHaveBeenCalledOnce();
    const [exercises] = onAdd.mock.calls[0];
    expect(exercises).toHaveLength(1);
    expect(exercises[0].name).toBe('Squat');
  });

  it('calls onClose when X button is clicked', async () => {
    const { onClose } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const { onClose } = renderSheet();
    await userEvent.click(screen.getByTestId('exercise-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows usage count from sessions', () => {
    renderSheet({ sessions: [mockSession(['squat']), mockSession(['squat'])] });
    expect(screen.getByText('2 times')).toBeInTheDocument();
  });

  it('shows "—" for exercises with no usage', () => {
    renderSheet({ sessions: [] });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
npx vitest run src/test/AddExerciseSheet.test.tsx
```

Expected: All tests fail with `Cannot find module '@/components/AddExerciseSheet'`

---

## Task 2: Implement AddExerciseSheet

**Files:**
- Create: `src/components/AddExerciseSheet.tsx`

- [ ] **Step 3: Create the component**

```tsx
// src/components/AddExerciseSheet.tsx
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { EXERCISES } from "@/data/sampleProgram";
import { Exercise, MuscleGroup, Session } from "@/types/training";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function computeUsageCounts(sessions: Session[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    for (const log of session.exercises) {
      const id = log.exercise.id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const ALL_EXERCISES = Object.values(EXERCISES);

const MUSCLE_GROUPS: MuscleGroup[] = Array.from(
  new Set(ALL_EXERCISES.map((e) => e.muscleGroup))
).sort() as MuscleGroup[];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddExerciseSheetProps {
  visible: boolean;
  sessions: Session[];
  onClose: () => void;
  onAdd: (exercises: Exercise[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddExerciseSheet({ visible, sessions, onClose, onAdd }: AddExerciseSheetProps) {
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset state each time sheet opens
  useEffect(() => {
    if (visible) {
      setQuery("");
      setMuscleFilter(null);
      setSelected(new Set());
    }
  }, [visible]);

  const usageCounts = useMemo(() => computeUsageCounts(sessions), [sessions]);

  const filteredExercises = useMemo(() => {
    const q = query.toLowerCase();
    return ALL_EXERCISES
      .filter((ex) => {
        const matchesQuery = ex.name.toLowerCase().includes(q);
        const matchesMuscle = muscleFilter === null || ex.muscleGroup === muscleFilter;
        return matchesQuery && matchesMuscle;
      })
      .sort((a, b) => (usageCounts[b.id] ?? 0) - (usageCounts[a.id] ?? 0));
  }, [query, muscleFilter, usageCounts]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    onAdd(ALL_EXERCISES.filter((ex) => selected.has(ex.id)));
  };

  const addLabel = selected.size > 0 ? `Add Exercises (${selected.size})` : "Add Exercises";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        data-testid="exercise-sheet-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 79,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition: "opacity 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "85vh",
          background: "#FFFFFF",
          borderRadius: "16px 16px 0 0",
          zIndex: 80,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 16px 12px",
            borderBottom: "0.5px solid #D3D1C7",
            flexShrink: 0,
          }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#888780",
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
              width: 28,
            }}
          >
            ×
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#2C2C2A" }}>Exercises</span>
          <div style={{ width: 28 }} />
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#F1EFE8",
              border: "0.5px solid #D3D1C7",
              borderRadius: 10,
              padding: "9px 12px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="#888780" strokeWidth="1.5" />
              <path d="M9.5 9.5l2.5 2.5" stroke="#888780" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercise name"
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                fontSize: 14,
                color: "#2C2C2A",
              }}
            />
          </div>
        </div>

        {/* Muscle group filter pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 16px",
            overflowX: "auto",
            flexShrink: 0,
            scrollbarWidth: "none",
          }}
        >
          <button
            onClick={() => setMuscleFilter(null)}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              borderRadius: 20,
              border: "0.5px solid #D3D1C7",
              background: muscleFilter === null ? "#7F77DD" : "#F1EFE8",
              color: muscleFilter === null ? "white" : "#5F5E5A",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((mg) => (
            <button
              key={mg}
              onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
              style={{
                flexShrink: 0,
                padding: "5px 12px",
                borderRadius: 20,
                border: "0.5px solid #D3D1C7",
                background: muscleFilter === mg ? "#7F77DD" : "#F1EFE8",
                color: muscleFilter === mg ? "white" : "#5F5E5A",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {mg}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#888780",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "8px 0 4px",
            }}
          >
            Recent Exercises
          </div>

          {filteredExercises.map((ex) => {
            const isSelected = selected.has(ex.id);
            const count = usageCounts[ex.id] ?? 0;
            return (
              <div
                key={ex.id}
                onClick={() => toggleSelect(ex.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 8px",
                  borderBottom: "0.5px solid #F1EFE8",
                  background: isSelected ? "#F3F2FD" : "transparent",
                  cursor: "pointer",
                  borderRadius: 8,
                  transition: "background 0.15s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 1 }}>
                    {ex.muscleGroup}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#888780", flexShrink: 0, marginRight: 8 }}>
                  {count > 0 ? `${count} ${count === 1 ? "time" : "times"}` : "—"}
                </div>
                {/* Inline checkbox — matches SetCheckbox visual style */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: isSelected ? "1.5px solid #7F77DD" : "1.5px solid #B4B2A9",
                    background: isSelected ? "#7F77DD" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M2 5.5l2.5 2.5 4.5-4.5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: "0.5px solid #D3D1C7",
            padding: "12px 16px",
            background: "#FFFFFF",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            disabled
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 12,
              border: "0.5px solid #D3D1C7",
              background: "transparent",
              fontSize: 14,
              fontWeight: 500,
              color: "#B4B2A9",
              cursor: "not-allowed",
            }}
          >
            Add as Superset
          </button>
          <button
            onClick={selected.size > 0 ? handleAdd : undefined}
            disabled={selected.size === 0}
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 12,
              border: "none",
              background: selected.size > 0 ? "#7F77DD" : "#D3D1C7",
              fontSize: 14,
              fontWeight: 500,
              color: "white",
              cursor: selected.size > 0 ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            {addLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
npx vitest run src/test/AddExerciseSheet.test.tsx
```

Expected: All 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddExerciseSheet.tsx src/test/AddExerciseSheet.test.tsx
git commit -m "feat: add AddExerciseSheet component with search, filter, and multi-select"
```

---

## Task 3: Wire AddExerciseSheet into ActiveWorkout

**Files:**
- Modify: `src/components/ActiveWorkout.tsx`

The changes are minimal — three additions to the existing component:

1. Read `sessions` and `addExercise` from the Zustand store
2. Add `showAddExercise` state + handler
3. Wire the "Add Exercise" button and render the sheet

- [ ] **Step 6: Add store reads + state at the top of `ActiveWorkout`**

In `src/components/ActiveWorkout.tsx`, locate the existing store read (line 635):
```tsx
const activeSession = useTrainingStore((s) => s.activeSession);
```

Replace it with:
```tsx
const activeSession = useTrainingStore((s) => s.activeSession);
const sessions = useTrainingStore((s) => s.sessions);
const addExerciseToStore = useTrainingStore((s) => s.addExercise);
```

Then add `showAddExercise` alongside the existing `activeInput` state (line 638):
```tsx
const [activeInput, setActiveInput] = useState<ActiveInput | null>(null);
const [showAddExercise, setShowAddExercise] = useState(false);
```

- [ ] **Step 7: Add the `handleAddExercises` callback**

First, add `Exercise` to the imports at the top of `ActiveWorkout.tsx`. The file currently has no type imports from `@/types/training` — add this line after the existing imports:

```tsx
import { Exercise } from "@/types/training";
```

Then add this function after `handleRPE` (around line 748), before the `return`:

```tsx
const handleAddExercises = (newExercises: Exercise[]) => {
  newExercises.forEach((ex) => {
    addExerciseToStore({ exercise: ex, sets: [] });
  });
  setExercises((prev) => [
    ...prev,
    ...newExercises.map((ex, i) => ({
      id: Date.now() + i,
      name: ex.name,
      sets: [],
    })),
  ]);
  setShowAddExercise(false);
};
```

- [ ] **Step 8: Wire the "Add Exercise" button**

Find the "Add Exercise" button (around line 874):
```tsx
<button
  style={{
    display: "flex",
    ...
  }}
>
```

Add `onClick` to it:
```tsx
<button
  onClick={() => setShowAddExercise(true)}
  style={{
    display: "flex",
    ...
  }}
>
```

- [ ] **Step 9: Add the import and render AddExerciseSheet**

At the top of `ActiveWorkout.tsx`, add the import after the existing imports:
```tsx
import { AddExerciseSheet } from "./AddExerciseSheet";
```

`AddExerciseSheet` uses `createPortal` internally, so render it directly (no outer portal needed). Place it immediately before the closing `</div>` of the root container (after the Numpad `{createPortal(...)}` block, around line 910):

```tsx
<AddExerciseSheet
  visible={showAddExercise}
  sessions={sessions}
  onClose={() => setShowAddExercise(false)}
  onAdd={handleAddExercises}
/>
```

- [ ] **Step 10: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (AddExerciseSheet tests + existing TrainTab tests).

- [ ] **Step 11: Commit**

```bash
git add src/components/ActiveWorkout.tsx
git commit -m "feat: wire Add Exercise button to open AddExerciseSheet"
```
