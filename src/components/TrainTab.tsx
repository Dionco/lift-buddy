import { useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import {
  ExerciseLog,
  ProgramExercise,
  Session,
  SetLog,
} from '@/types/training';
import { lastTopSet } from '@/lib/e1rm';
import { fatigueSignal, type FatigueSignal } from '@/lib/progressSignal';
import { formatMuscles } from '@/lib/muscleLabels';

interface TrainTabProps {
  onStartEmpty: () => void;
  onStartToday: (exercises: ExerciseLog[], name: string, dayId: string) => void;
  onViewProgram: () => void;
}

const PHASE_META: Record<string, { label: string; tone: string }> = {
  Volume:        { label: 'Accumulation',   tone: 'Build muscle, refine technique, manage fatigue' },
  Strength:      { label: 'Intensification', tone: 'Heavier loads, lower rep ranges, sharpen output' },
  Peaking:       { label: 'Realization',    tone: 'Express strength on the competition lifts' },
  Recovery:      { label: 'Deload',         tone: 'Strategic backoff to dissipate fatigue' },
  'General Prep':{ label: 'Accumulation',   tone: 'Build muscle, refine technique, manage fatigue' },
  Intensity:     { label: 'Intensification', tone: 'Heavier loads, lower rep ranges, sharpen output' },
  'Max Effort':  { label: 'Realization',    tone: 'Express strength on the competition lifts' },
};

export function TrainTab({ onStartEmpty, onStartToday, onViewProgram }: TrainTabProps) {
  const { program, sessions } = useTrainingStore();
  const [fatigueDismissed, setFatigueDismissed] = useState(false);

  const block = program.blocks[program.currentBlockIndex];
  const week = block?.weeks[program.currentWeekIndex];
  const day = week?.days[program.currentDayIndex];
  if (!block || !week || !day) {
    return (
      <div className="train-view">
        <div className="tv-top">
          <div className="tv-eyebrow">Lift Buddy</div>
        </div>
        <div className="tv-hero">
          <h1 className="tv-day-name">No active session</h1>
        </div>
        <div className="tv-ctas">
          <button type="button" className="tv-cta-secondary" onClick={onStartEmpty}>
            Start an empty workout
          </button>
        </div>
      </div>
    );
  }

  const phase = PHASE_META[block.focus] ?? { label: block.focus, tone: '' };
  const cleanName = day.name.replace(/^Day\s*\d+\s*[—-]\s*/, '');
  const totalSets = day.exercises.reduce((s, pe) => s + pe.prescription.sets, 0);
  const mainCount = day.exercises.filter((e) => e.exercise.isMainLift).length;
  const todaysMain = day.exercises.find((e) => e.exercise.isMainLift);
  const fatigue = todaysMain ? fatigueSignal(sessions, todaysMain.exercise) : null;

  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const mainLifts = day.exercises.filter((pe) => pe.exercise.isMainLift);
  const accessories = day.exercises.filter((pe) => !pe.exercise.isMainLift);

  const handleStartToday = () => {
    const exercises: ExerciseLog[] = day.exercises.map((pe) => {
      const sets: SetLog[] = Array.from({ length: pe.prescription.sets }, (_, i) => ({
        id: `preset-${Date.now()}-${i}`,
        weight: 0,
        reps: 0,
        rpe: pe.prescription.rpeTarget ?? 7,
        timestamp: 0,
        completed: false,
      }));
      return { exercise: pe.exercise, sets };
    });
    const name = `Week ${week.weekNumber} · ${day.name}`;
    onStartToday(exercises, name, day.id);
  };

  return (
    <div className="train-view">
      <div className="tv-top">
        <div className="tv-eyebrow">
          <span className="tv-eyebrow-w">{phase.label}</span>
          <span className="tv-eyebrow-dot">·</span>
          <span className="tv-eyebrow-w">Block {program.currentBlockIndex + 1}</span>
          <span className="tv-eyebrow-dot">·</span>
          <span className="tv-eyebrow-w">Week {week.weekNumber}</span>
        </div>
        <div className="tv-date">{dateStr}</div>
      </div>

      <div className="tv-hero">
        <div className="tv-day-num">
          <span className="tv-day-num-label">Day</span>
          <span className="tv-day-num-val">{program.currentDayIndex + 1}</span>
          <span className="tv-day-num-of">/ {week.days.length}</span>
        </div>
        <h1 className="tv-day-name">{cleanName}</h1>
        <div className="tv-day-stats">
          <div className="tv-stat">
            <div className="tv-stat-num">{day.exercises.length}</div>
            <div className="tv-stat-label">Exercises</div>
          </div>
          <div className="tv-stat-rule" />
          <div className="tv-stat">
            <div className="tv-stat-num">{totalSets}</div>
            <div className="tv-stat-label">Working sets</div>
          </div>
          <div className="tv-stat-rule" />
          <div className="tv-stat">
            <div className="tv-stat-num">{mainCount}</div>
            <div className="tv-stat-label">Main {mainCount === 1 ? 'lift' : 'lifts'}</div>
          </div>
        </div>
      </div>

      {fatigue && !fatigueDismissed && (
        <FatigueBanner signal={fatigue} onDismiss={() => setFatigueDismissed(true)} />
      )}

      <div className="tv-docket">
        <div className="tv-docket-head">
          <span className="tv-docket-eyebrow">Today's Docket</span>
          <button type="button" className="tv-docket-action" onClick={onViewProgram}>
            <span>View Program</span>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path
                d="M3 2l4 3.5L3 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {mainLifts.length > 0 && (
          <>
            <div className="tv-section-rule">
              <span>Main Lifts</span>
              <div className="tv-section-line" />
            </div>
            {mainLifts.map((pe, i) => (
              <DocketRow key={pe.exercise.id} pe={pe} sessions={sessions} index={i} isMain />
            ))}
          </>
        )}

        {accessories.length > 0 && (
          <>
            <div className="tv-section-rule">
              <span>Accessories</span>
              <div className="tv-section-line" />
            </div>
            {accessories.map((pe, i) => (
              <DocketRow
                key={pe.exercise.id}
                pe={pe}
                sessions={sessions}
                index={mainLifts.length + i}
                isMain={false}
              />
            ))}
          </>
        )}
      </div>

      <div className="tv-ctas">
        <button type="button" className="tv-cta-primary" onClick={handleStartToday}>
          <span className="tv-cta-label">Start Session</span>
          <span className="tv-cta-meta">{cleanName}</span>
        </button>
        <button type="button" className="tv-cta-secondary" onClick={onStartEmpty}>
          Start an empty workout
        </button>
      </div>
    </div>
  );
}

interface DocketRowProps {
  pe: ProgramExercise;
  sessions: Session[];
  index: number;
  isMain: boolean;
}

// Default docket variant: stacked plate bars (one per prescribed set), with the
// last top-set weight pinned to the right of main lifts.
function DocketRow({ pe, sessions, index, isMain }: DocketRowProps) {
  const setBars = Array.from({ length: pe.prescription.sets });
  const last = isMain ? lastTopSet(sessions, pe.exercise.id) : null;
  return (
    <div className={`dr ${isMain ? 'is-main' : ''}`}>
      <div className="dr-num">{String(index + 1).padStart(2, '0')}</div>
      <div className="dr-body">
        <div className="dr-name-row">
          <span className="dr-name">{pe.exercise.name}</span>
          <span className="dr-mg">{formatMuscles(pe.exercise)}</span>
        </div>
        <div className="dr-plates-row">
          <div className="dr-plates-bars" aria-hidden>
            {setBars.map((_, i) => (
              <i
                key={i}
                className="dr-plate-bar"
                style={{
                  display: 'block',
                  width: 5,
                  height: isMain ? 22 : 18,
                  background: isMain ? 'var(--accent)' : 'var(--ink)',
                  borderRadius: 1,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          <span className="dr-plates-rx">
            <span className="dr-rx-sets">{pe.prescription.sets}</span>
            <span className="dr-plates-of">sets ×</span>
            <span className="dr-rx-reps">{pe.prescription.reps}</span>
            {pe.prescription.rpeTarget != null && (
              <span className="dr-plates-rpe">@{pe.prescription.rpeTarget}</span>
            )}
          </span>
          {isMain && last && (
            <span className="dr-plates-top">
              <span className="dr-plates-top-label">top</span>
              <span className="dr-plates-top-val">
                {last.weight}
                <span className="dr-plates-top-unit">kg</span>
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface FatigueBannerProps {
  signal: FatigueSignal;
  onDismiss: () => void;
}

function FatigueBanner({ signal, onDismiss }: FatigueBannerProps) {
  const min = Math.min(...signal.e1rms);
  const max = Math.max(...signal.e1rms);
  const range = max - min || 1;
  return (
    <div className="fatigue">
      <div className="fatigue-mark">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5v5l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
      <div className="fatigue-body">
        <div className="fatigue-head">
          <span className="fatigue-title">Fatigue signal</span>
          <span className="fatigue-meta">
            {signal.exerciseName} · {signal.e1rms.length} sessions
          </span>
        </div>
        <p className="fatigue-text">
          Top-set e1RM has trended down on {signal.exerciseName} ({signal.delta.toFixed(1)}kg over{' '}
          {signal.e1rms.length} sessions). Consider a deload — or push through if you've slept and
          eaten well.
        </p>
        <div className="fatigue-spark">
          {signal.e1rms.map((p, i) => {
            const h = ((p - min) / range) * 22 + 4;
            return (
              <div key={i} className="fs-bar-wrap">
                <div className="fs-bar" style={{ height: h }} />
                <div className="fs-val">{p.toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <button type="button" className="fatigue-x" onClick={onDismiss} aria-label="Dismiss">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
