import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTrainingStore } from '@/store/useTrainingStore';

describe('rest timer store slice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
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
    expect(useTrainingStore.getState().restEndsAt).toBe(Date.now() + 120_000);
  });

  it('endRest() clears restEndsAt to null', () => {
    useTrainingStore.getState().startRest(180);
    useTrainingStore.getState().endRest();
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });

  it('startRest with zero duration sets restEndsAt to now', () => {
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

describe('rest timer cleared on session boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
    localStorage.clear();
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
    useTrainingStore.setState({ activeSession: null, restEndsAt: 9999999999999 });
    useTrainingStore.getState().startSession('Test workout');
    expect(useTrainingStore.getState().restEndsAt).toBeNull();
  });
});
