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

// Minimal program fixture — one block, one day, 2 exercises
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
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Leg Press')).toBeInTheDocument();
    expect(screen.getByText('10-12')).toBeInTheDocument();
  });

  it('renders RPE target when defined', () => {
    renderTab();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders — when rpeTarget is undefined', () => {
    renderTab();
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
