import { describe, it, expect } from 'vitest';
import { suggestRest } from '@/lib/restTimer';
import { Exercise } from '@/types/training';

const squat: Pick<Exercise, 'id' | 'relatedTo'> = { id: 'squat' };
const deadlift: Pick<Exercise, 'id' | 'relatedTo'> = { id: 'deadlift' };
const sumo: Pick<Exercise, 'id' | 'relatedTo'> = { id: 'sumo-deadlift', relatedTo: 'deadlift' };
const curl: Pick<Exercise, 'id' | 'relatedTo'> = { id: 'curl' };

describe('suggestRest', () => {
  it('1–5 reps → 240s (maximal strength)', () => {
    expect(suggestRest(1, squat)).toBe(240);
    expect(suggestRest(3, squat)).toBe(240);
    expect(suggestRest(5, squat)).toBe(240);
  });

  it('6–8 reps → 180s (strength-hypertrophy)', () => {
    expect(suggestRest(6, squat)).toBe(180);
    expect(suggestRest(8, squat)).toBe(180);
  });

  it('9–12 reps → 150s (hypertrophy midpoint)', () => {
    expect(suggestRest(9, squat)).toBe(150);
    expect(suggestRest(12, squat)).toBe(150);
  });

  it('13+ reps → 90s (endurance / accessories)', () => {
    expect(suggestRest(13, curl)).toBe(90);
    expect(suggestRest(20, curl)).toBe(90);
  });

  it('adds 60s for the Deadlift', () => {
    expect(suggestRest(3, deadlift)).toBe(300);
    expect(suggestRest(8, deadlift)).toBe(240);
  });

  it('adds 60s for Deadlift variations via relatedTo', () => {
    expect(suggestRest(5, sumo)).toBe(300);
  });

  it('does not bump non-deadlift exercises', () => {
    expect(suggestRest(3, squat)).toBe(240);
    expect(suggestRest(3, curl)).toBe(240);
  });

  it('handles a missing exercise (no bump)', () => {
    expect(suggestRest(3, undefined)).toBe(240);
  });

  it('does not gate on RPE — heavy triple at RPE 7 still gets strength-band rest', () => {
    // Regression: the old logic returned 180s for reps<=5 && rpe<8. The fix is
    // that rep range alone determines the band.
    expect(suggestRest(3, squat)).toBe(240);
  });
});
