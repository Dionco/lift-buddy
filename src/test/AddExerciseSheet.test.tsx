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
    exercise: { id, name: id, primaryMuscles: ['Quads'], isMainLift: false },
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

  it('shows "Results" label when search query is active', async () => {
    renderSheet();
    await userEvent.type(screen.getByPlaceholderText('Search exercise name'), 'squat');
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.queryByText('Recent Exercises')).not.toBeInTheDocument();
  });

  it('shows empty state message when no exercises match the search', async () => {
    renderSheet();
    await userEvent.type(screen.getByPlaceholderText('Search exercise name'), 'xyznotanexercise');
    expect(screen.getByText('No exercises found')).toBeInTheDocument();
  });
});
