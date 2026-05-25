// src/test/SessionSummary.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSummary } from '@/components/SessionSummary';
import type { Session } from '@/types/training';

vi.mock('@/store/useTrainingStore', () => ({
  useTrainingStore: vi.fn(),
}));

import { useTrainingStore } from '@/store/useTrainingStore';

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
          weekNumber: 1,
          days: [
            {
              id: 'b1d1',
              name: 'Day 1',
              exercises: [
                {
                  exercise: {
                    id: 'squat',
                    name: 'Squat',
                    primaryMuscles: ['Quads'],
                    isMainLift: true,
                  },
                  prescription: { sets: 3, reps: '5', rpeTarget: 8 },
                },
              ],
            },
            {
              id: 'b1d2',
              name: 'Day 2',
              exercises: [
                {
                  exercise: {
                    id: 'bench',
                    name: 'Bench',
                    primaryMuscles: ['Chest'],
                    isMainLift: true,
                  },
                  prescription: { sets: 3, reps: '5', rpeTarget: 8 },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_003_600_000,
    exercises: [],
    ...overrides,
  };
}

interface MockStoreState {
  program: typeof mockProgram;
  finishSession: ReturnType<typeof vi.fn>;
  advanceProgramCursor: ReturnType<typeof vi.fn>;
  setProgramCursor: ReturnType<typeof vi.fn>;
  restartProgram: ReturnType<typeof vi.fn>;
  loadingIncrement: number;
}

function mockStore(): MockStoreState {
  const state: MockStoreState = {
    program: mockProgram,
    finishSession: vi.fn(),
    advanceProgramCursor: vi.fn(() => ({ blockBoundaryCrossed: false, programComplete: false })),
    setProgramCursor: vi.fn(),
    restartProgram: vi.fn(),
    loadingIncrement: 2.5,
  };
  (useTrainingStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: (s: MockStoreState) => unknown) => selector(state),
  );
  return state;
}

describe('SessionSummary save button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves and closes when a non-program (empty) workout is finished', async () => {
    // Regression: previously the only visible save button was disabled when
    // session.programDayId was missing, so empty-workout sessions could never
    // be persisted from the Summary screen.
    const state = mockStore();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SessionSummary
        session={makeSession({ programDayId: undefined })}
        onClose={onClose}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /save & close/i });
    expect(saveButton).not.toBeDisabled();

    await user.click(saveButton);

    expect(state.finishSession).toHaveBeenCalledTimes(1);
    expect(state.advanceProgramCursor).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('advances the program cursor when a program-day workout is marked complete', async () => {
    const state = mockStore();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SessionSummary
        session={makeSession({ programDayId: 'b1d1' })}
        onClose={onClose}
      />,
    );

    const advanceButton = screen.getByRole('button', {
      name: /mark complete & advance program/i,
    });
    await user.click(advanceButton);

    expect(state.finishSession).toHaveBeenCalledTimes(1);
    expect(state.advanceProgramCursor).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saves without advancing when the secondary button is tapped on a program-day workout', async () => {
    const state = mockStore();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SessionSummary
        session={makeSession({ programDayId: 'b1d1' })}
        onClose={onClose}
      />,
    );

    const saveOnlyButton = screen.getByRole('button', {
      name: /save without advancing cursor/i,
    });
    await user.click(saveOnlyButton);

    expect(state.finishSession).toHaveBeenCalledTimes(1);
    expect(state.advanceProgramCursor).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
