import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTrainingStore, migrate } from '@/store/useTrainingStore';

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

describe('v9 migration', () => {
  it('defaults restEndsAt to null when migrating from v8', () => {
    const v8State = {
      sessions: [],
      program: { id: 'p', name: 'P', blocks: [], currentBlockIndex: 0, currentWeekIndex: 0, currentDayIndex: 0 },
      activeSession: null,
      restTimerDuration: 120,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,
    };
    const v9State = migrate(v8State, 8) as Record<string, unknown>;
    expect(v9State.restEndsAt).toBeNull();
  });

  it('drops the dead restTimerDuration field when migrating from v8', () => {
    const v8State = {
      sessions: [],
      program: { id: 'p', name: 'P', blocks: [], currentBlockIndex: 0, currentWeekIndex: 0, currentDayIndex: 0 },
      activeSession: null,
      restTimerDuration: 90,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,
    };
    const v9State = migrate(v8State, 8) as Record<string, unknown>;
    expect(v9State.restTimerDuration).toBeUndefined();
  });

  it('preserves a non-null restEndsAt that already exists (round-trip v9 → v9)', () => {
    const v9In = {
      sessions: [],
      program: { id: 'p', name: 'P', blocks: [], currentBlockIndex: 0, currentWeekIndex: 0, currentDayIndex: 0 },
      activeSession: null,
      trainingMaxes: null,
      loadingIncrement: 2.5,
      lastReadiness: null,
      restEndsAt: 1234567890,
    };
    const v9Out = migrate(v9In, 9) as Record<string, unknown>;
    expect(v9Out.restEndsAt).toBe(1234567890);
  });
});
