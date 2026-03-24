# Train Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Train tab's three generic list-item cards with a rich session card showing program name, week/day, exercise table (name/sets/reps/RPE), and a CTA button, plus an always-visible Start Empty Workout button below.

**Architecture:** Single component rewrite — `TrainTab.tsx` is the only file changed. No new store state, no new dependencies. The component already receives all needed data via `useTrainingStore` and its three callback props.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-25-train-tab-redesign-design.md`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/test/TrainTab.test.tsx` | Component tests (written first) |
| Modify | `src/components/TrainTab.tsx` | Full component rewrite |

---

## Task 1: Write Failing Tests

**Files:**
- Create: `src/test/TrainTab.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/test/TrainTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrainTab } from '@/components/TrainTab';

// Mock the Zustand store
vi.mock('@/store/useTrainingStore', () => ({
  useTrainingStore: vi.fn(),
}));

import { useTrainingStore } from '@/store/useTrainingStore';

// Minimal program fixture — one block, one day, 3 exercises
const mockProgram = {
  id: 'prog1',
  name: 'Test Program',
  currentBlockIndex: 0,
  currentDayIndex: 0,
  blocks: [
    {
      id: 'b1',
      name: 'Block 1',
      weekNumber: 2,
      focus: 'Strength',
      days: [
        {
          id: 'b1d1',
          name: 'Day 1 — Squat',
          exercises: [
            {
              exercise: { id: 'squat', name: 'Squat', muscleGroup: 'Quads', isMainLift: true },
              prescription: { sets: 5, reps: '5', rpeTarget: 8 },
            },
            {
              exercise: { id: 'press', name: 'Leg Press', muscleGroup: 'Quads', isMainLift: false },
              prescription: { sets: 3, reps: '10-12', rpeTarget: undefined },
            },
          ],
        },
      ],
    },
  ],
};

const mockStoreWithProgram = { program: mockProgram };

const mockStoreNoProgram = {
  program: {
    id: 'empty',
    name: 'Empty',
    currentBlockIndex: 99, // out of bounds → currentBlock undefined
    currentDayIndex: 0,
    blocks: [],
  },
};

describe('TrainTab', () => {
  const onStartEmpty = vi.fn();
  const onStartToday = vi.fn();
  const onViewProgram = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderTab(storeState = mockStoreWithProgram) {
    (useTrainingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(storeState);
    return render(
      <TrainTab
        onStartEmpty={onStartEmpty}
        onStartToday={onStartToday}
        onViewProgram={onViewProgram}
      />
    );
  }

  // --- Layout ---

  it('renders the Train heading', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: /train/i })).toBeInTheDocument();
  });

  it('always renders the Start Empty Workout button', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /start empty workout/i })).toBeInTheDocument();
  });

  it('renders Start Empty Workout button even when no program', () => {
    renderTab(mockStoreNoProgram);
    expect(screen.getByRole('button', { name: /start empty workout/i })).toBeInTheDocument();
  });

  // --- No-program state ---

  it('does not render session card when currentBlock is undefined', () => {
    renderTab(mockStoreNoProgram);
    expect(screen.queryByText('Test Program')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start week/i })).not.toBeInTheDocument();
  });

  // --- Session card: header ---

  it('renders the program name as a button in the card header', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /test program/i })).toBeInTheDocument();
  });

  it('renders the week and day label', () => {
    renderTab();
    expect(screen.getByText(/week 2/i)).toBeInTheDocument();
    expect(screen.getByText(/day 1 — squat/i)).toBeInTheDocument();
  });

  // --- Session card: exercise table ---

  it('renders column headers: Exercise, Sets, Reps, RPE', () => {
    renderTab();
    expect(screen.getByText('Exercise')).toBeInTheDocument();
    expect(screen.getByText('Sets')).toBeInTheDocument();
    expect(screen.getByText('Reps')).toBeInTheDocument();
    expect(screen.getByText('RPE')).toBeInTheDocument();
  });

  it('renders a row for each exercise with name, sets, reps', () => {
    renderTab();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // sets
    // reps '5' also appears as sets value — check both exercise names at minimum
    expect(screen.getByText('Leg Press')).toBeInTheDocument();
    expect(screen.getByText('10-12')).toBeInTheDocument();
  });

  it('renders RPE target when defined', () => {
    renderTab();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders — when rpeTarget is undefined', () => {
    renderTab();
    // Leg Press has no rpeTarget
    const dashCells = screen.getAllByText('—');
    expect(dashCells.length).toBeGreaterThanOrEqual(1);
  });

  // --- Session card: CTA button ---

  it('renders CTA button with correct label', () => {
    renderTab();
    expect(
      screen.getByRole('button', { name: /start week 2 · day 1 — squat/i })
    ).toBeInTheDocument();
  });

  // --- Interactions ---

  it('calls onViewProgram when program name is clicked', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /test program/i }));
    expect(onViewProgram).toHaveBeenCalledOnce();
  });

  it('calls onStartEmpty when Start Empty Workout is clicked', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /start empty workout/i }));
    expect(onStartEmpty).toHaveBeenCalledOnce();
  });

  it('calls onStartToday with correct arguments when CTA is clicked', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /start week 2 · day 1 — squat/i }));
    expect(onStartToday).toHaveBeenCalledOnce();
    const [exercises, name, dayId] = onStartToday.mock.calls[0];
    expect(name).toBe('Week 2 · Day 1 — Squat');
    expect(dayId).toBe('b1d1');
    expect(exercises).toHaveLength(2);
    expect(exercises[0].exercise.name).toBe('Squat');
  });
});
```

- [ ] **Step 2: Install `@testing-library/user-event` if not already present**

Check: `grep "@testing-library/user-event" package.json`

If missing, run:
```bash
npm install --save-dev @testing-library/user-event
```

- [ ] **Step 3: Run the tests and confirm they fail**

```bash
npx vitest run src/test/TrainTab.test.tsx
```

Expected: multiple failures — `TrainTab` still has the old implementation.

---

## Task 2: Implement the Redesigned TrainTab

**Files:**
- Modify: `src/components/TrainTab.tsx`

- [ ] **Step 1: Replace the component with the new implementation**

```tsx
// src/components/TrainTab.tsx
import { useTrainingStore } from '@/store/useTrainingStore';
import { ExerciseLog, SetLog } from '@/types/training';
import { ChevronRight } from 'lucide-react';

interface TrainTabProps {
  onStartEmpty: () => void;
  onStartToday: (exercises: ExerciseLog[], name: string, dayId: string) => void;
  onViewProgram: () => void;
}

export function TrainTab({ onStartEmpty, onStartToday, onViewProgram }: TrainTabProps) {
  const { program } = useTrainingStore();
  const currentBlock = program.blocks[program.currentBlockIndex];
  const currentDay = currentBlock?.days[program.currentDayIndex];

  const handleStartToday = () => {
    if (!currentBlock || !currentDay) return;
    const exercises: ExerciseLog[] = currentDay.exercises.map((pe) => {
      const sets: SetLog[] = Array.from({ length: pe.prescription.sets }, (_, i) => ({
        id: `preset-${Date.now()}-${i}`,
        weight: 0,
        reps: 0,
        rpe: pe.prescription.rpeTarget || 7,
        timestamp: 0,
        completed: false,
      }));
      return { exercise: pe.exercise, sets };
    });
    const name = `Week ${currentBlock.weekNumber} · ${currentDay.name}`;
    onStartToday(exercises, name, currentDay.id);
  };

  return (
    <div className="flex flex-col gap-4 p-5 pb-24">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Train</h1>

      {currentBlock && currentDay && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onViewProgram}
              className="flex items-center gap-0.5 flex-1 min-w-0 min-h-[44px] text-sm font-medium text-primary"
            >
              <span className="truncate">{program.name}</span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-primary" />
            </button>
            <span className="flex-shrink-0 text-sm text-muted-foreground">
              Week {currentBlock.weekNumber} · {currentDay.name}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-border my-3" />

          {/* Exercise table */}
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-xs text-muted-foreground pb-1">
            <span className="text-left">Exercise</span>
            <span className="text-center w-10">Sets</span>
            <span className="text-center w-10">Reps</span>
            <span className="text-center w-10">RPE</span>
          </div>
          {/* Data rows */}
          <div className="divide-y divide-border">
            {currentDay.exercises.map((pe) => (
              <div
                key={pe.exercise.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 py-2 items-center"
              >
                <span className="text-sm font-medium text-foreground text-left">
                  {pe.exercise.name}
                </span>
                <span className="text-sm text-foreground text-center w-10">
                  {pe.prescription.sets}
                </span>
                <span className="text-sm text-foreground text-center w-10">
                  {pe.prescription.reps}
                </span>
                <span className="text-sm text-foreground text-center w-10">
                  {pe.prescription.rpeTarget ?? '—'}
                </span>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <div className="border-t border-border mt-3 pt-3">
            <button
              type="button"
              onClick={handleStartToday}
              className="bg-primary text-primary-foreground rounded-lg w-full min-h-[52px] font-semibold whitespace-normal text-center active:scale-[0.98] transition-transform"
            >
              Start Week {currentBlock.weekNumber} · {currentDay.name}
            </button>
          </div>
        </div>
      )}

      {/* Start Empty Workout */}
      <button
        type="button"
        onClick={onStartEmpty}
        className="w-full rounded-xl border border-border bg-background min-h-[52px] text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
      >
        Start Empty Workout
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/test/TrainTab.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass (no regressions).

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrainTab.tsx src/test/TrainTab.test.tsx
git commit -m "feat: redesign Train tab with rich session card"
```

---

## Task 3: Smoke-Test in the Browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:8080` in a browser.

- [ ] **Step 2: Verify the Train tab visually**

Check:
- "Train" heading visible
- Session card renders with program name (tappable), week/day label, exercise table, CTA button
- Exercise rows show name, sets, reps, RPE (or `—`)
- Tapping CTA starts the workout (navigates to active workout screen)
- Tapping program name navigates to program overview
- "Start Empty Workout" button below the card, tapping it starts an empty session

- [ ] **Step 3: Commit if any visual fixups were needed**

```bash
git add src/components/TrainTab.tsx
git commit -m "fix: train tab visual adjustments"
```
