import { Exercise } from '@/types/training';

const MAX_LABEL_MUSCLES = 2;

/**
 * Compact display label for an exercise's primary muscles. Shows up to
 * MAX_LABEL_MUSCLES separated by " · "; appends "+N" if more.
 *   ['Chest','Front Delts','Triceps'] → "Chest · Front Delts +1"
 */
export function formatMuscles(exercise: Pick<Exercise, 'primaryMuscles'>): string {
  const muscles = exercise.primaryMuscles;
  if (!muscles || muscles.length === 0) return '';
  if (muscles.length <= MAX_LABEL_MUSCLES) return muscles.join(' · ');
  const head = muscles.slice(0, MAX_LABEL_MUSCLES).join(' · ');
  return `${head} +${muscles.length - MAX_LABEL_MUSCLES}`;
}
