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

// Minimal program fixture — one block, one week (weekNumber 2), one day, 2 exercises
const mockProgram = {
  id: 'prog1',
  name: 'Test Program',
  currentBlockIndex: 0,
  currentWeekIndex: 0,
  currentDayIndex: 0,
  blocks: [
    {
      id: 'b1',
      name: 'Block 1',
      focus: 'Strength',
      weeks: [
        {
          id: 'b1w1',
          weekNumber: 2,
          days: [
            {
              id: 'b1d1',
              name: 'Day 1 — Squat',
              exercises: [
                {
                  exercise: { id: 'squat', name: 'Squat', primaryMuscles: ['Quads', 'Glutes'], isMainLift: true },
                  prescription: { sets: 5, reps: '5', rpeTarget: 8 },
                },
                {
                  exercise: { id: 'press', name: 'Leg Press', primaryMuscles: ['Quads', 'Glutes'], isMainLift: false },
                  prescription: { sets: 3, reps: '10-12', rpeTarget: undefined },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const mockStoreWithProgram = { program: mockProgram, sessions: [] };

const mockStoreNoProgram = {
  program: {
    id: 'empty',
    name: 'Empty',
    currentBlockIndex: 99, // out of bounds → currentBlock undefined
    currentWeekIndex: 0,
    currentDayIndex: 0,
    blocks: [],
  },
  sessions: [],
};

describe('TrainTab (editorial-industrial redesign)', () => {
  const onStartEmpty = vi.fn();
  const onStartToday = vi.fn();
  const onViewProgram = vi.fn();
  const onSetupMaxes = vi.fn();
  const onUpdateMaxes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderTab(storeState: typeof mockStoreWithProgram = mockStoreWithProgram) {
    (useTrainingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(storeState);
    return render(
      <TrainTab
        onStartEmpty={onStartEmpty}
        onStartToday={onStartToday}
        onViewProgram={onViewProgram}
        onSetupMaxes={onSetupMaxes}
        onUpdateMaxes={onUpdateMaxes}
      />
    );
  }

  // --- Always-on surfaces ---

  it('always renders the empty workout button', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /start an empty workout/i })).toBeInTheDocument();
  });

  it('renders empty workout button even when no program', () => {
    renderTab(mockStoreNoProgram);
    expect(screen.getByRole('button', { name: /start an empty workout/i })).toBeInTheDocument();
  });

  // --- No-program state ---

  it('does not render hero stats or docket when currentBlock is undefined', () => {
    renderTab(mockStoreNoProgram);
    expect(screen.queryByText(/today's docket/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/working sets/i)).not.toBeInTheDocument();
  });

  // --- Hero ---

  it('renders the cleaned day name (without "Day N —" prefix) as the hero heading', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: /^squat$/i })).toBeInTheDocument();
  });

  it('renders the block/week eyebrow context', () => {
    renderTab();
    // Phase label "Intensification" maps from focus "Strength"
    expect(screen.getByText(/intensification/i)).toBeInTheDocument();
    expect(screen.getByText(/block 1/i)).toBeInTheDocument();
    expect(screen.getByText(/week 2/i)).toBeInTheDocument();
  });

  it('renders the hero stat counts', () => {
    renderTab();
    expect(screen.getByText('Exercises')).toBeInTheDocument();
    expect(screen.getByText('Working sets')).toBeInTheDocument();
    expect(screen.getByText(/^main lift$/i)).toBeInTheDocument();
    // 2 exercises, 5 + 3 = 8 sets, 1 main lift
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  // --- Docket ---

  it('renders Today\'s Docket sectioned by Main Lifts and Accessories', () => {
    renderTab();
    expect(screen.getByText(/today's docket/i)).toBeInTheDocument();
    expect(screen.getByText('Main Lifts')).toBeInTheDocument();
    expect(screen.getByText('Accessories')).toBeInTheDocument();
  });

  it('renders an entry for each exercise with name and prescription', () => {
    renderTab();
    // Squat appears twice (hero day name + docket row name)
    expect(screen.getAllByText('Squat').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Leg Press')).toBeInTheDocument();
    expect(screen.getByText('10-12')).toBeInTheDocument();
    expect(screen.getByText('@8')).toBeInTheDocument();
  });

  // --- CTAs ---

  it('renders the primary CTA with the cleaned day name', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /start session\s*squat/i })).toBeInTheDocument();
  });

  it('renders the View Program action', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /view program/i })).toBeInTheDocument();
  });

  // --- Interactions ---

  it('calls onViewProgram when View Program is clicked', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /view program/i }));
    expect(onViewProgram).toHaveBeenCalledOnce();
  });

  it('calls onStartEmpty when the empty workout button is clicked', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /start an empty workout/i }));
    expect(onStartEmpty).toHaveBeenCalledOnce();
  });

  it('calls onStartToday with correct arguments when the primary CTA is clicked', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /start session\s*squat/i }));
    expect(onStartToday).toHaveBeenCalledOnce();
    const [exercises, name, dayId] = onStartToday.mock.calls[0];
    expect(name).toBe('Week 2 · Day 1 — Squat');
    expect(dayId).toBe('b1d1');
    expect(exercises).toHaveLength(2);
    expect(exercises[0].exercise.name).toBe('Squat');
  });
});
