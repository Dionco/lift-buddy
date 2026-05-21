import { useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { ProgramBlock, ProgramDay, ProgramExercise, ProgramWeek } from '@/types/training';
import { isCursor, isPast } from '@/lib/programCursor';
import { formatMuscles } from '@/lib/muscleLabels';

interface ProgramOverviewProps {
  onBack: () => void;
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

interface DayCoord { bi: number; wi: number; di: number }

export function ProgramOverview({ onBack }: ProgramOverviewProps) {
  const { program, setProgramCursor } = useTrainingStore();
  const [focusedBlockIdx, setFocusedBlockIdx] = useState(program.currentBlockIndex);
  const [focusedDay, setFocusedDay] = useState<DayCoord | null>(null);

  const block = program.blocks[focusedBlockIdx];
  const phase = PHASE_META[block.focus] ?? { label: block.focus, tone: '' };
  const totalWeeks = program.blocks.reduce((s, b) => s + b.weeks.length, 0);
  const completedWeeks =
    program.blocks
      .slice(0, program.currentBlockIndex)
      .reduce((s, b) => s + b.weeks.length, 0) + program.currentWeekIndex;

  const handleJump = (coord: DayCoord) => {
    setProgramCursor(coord.bi, coord.wi, coord.di);
    setFocusedDay(null);
    onBack();
  };

  return (
    <div className="program-view">
      <header className="pv-header">
        <button type="button" className="pv-back" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12 4l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div>
          <div className="pv-eyebrow">Program</div>
          <h1 className="pv-title">{program.name}</h1>
        </div>
      </header>

      <div className="pv-timeline">
        <div className="pv-timeline-rule">
          {program.blocks.map((b, i) => {
            const isPast = i < program.currentBlockIndex;
            const isCurrent = i === program.currentBlockIndex;
            return (
              <button
                key={b.id}
                type="button"
                className={`pv-tl-seg ${isPast ? 'is-past' : ''} ${isCurrent ? 'is-current' : ''} ${i === focusedBlockIdx ? 'is-focused' : ''}`}
                style={{ flex: b.weeks.length }}
                onClick={() => setFocusedBlockIdx(i)}
              >
                <span className="pv-tl-seg-label">B{i + 1}</span>
                <span className="pv-tl-seg-fill" />
                {isCurrent && (
                  <span
                    className="pv-tl-cursor"
                    style={{
                      left: `${((program.currentWeekIndex + 0.5) / b.weeks.length) * 100}%`,
                    }}
                  >
                    <span className="pv-tl-cursor-dot" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="pv-timeline-scale">
          <span>Week 1</span>
          <span className="pv-tl-progress">
            <span className="pv-tl-progress-num">{completedWeeks + 1}</span>
            <span className="pv-tl-progress-of"> / {totalWeeks}</span>
          </span>
          <span>Week {totalWeeks}</span>
        </div>
      </div>

      <div className="pv-block-head">
        <div className="pv-block-meta">
          <span className="pv-block-num">Block {focusedBlockIdx + 1}</span>
          <span className="pv-block-dot">·</span>
          <span className="pv-block-phase">{phase.label}</span>
          {focusedBlockIdx === program.currentBlockIndex && (
            <span className="pv-active-pill">Active</span>
          )}
        </div>
        <h2 className="pv-block-name">{block.name}</h2>
        {phase.tone && <p className="pv-block-tone">{phase.tone}</p>}
      </div>

      <div className="pv-grid">
        {block.weeks.map((week, wi) => (
          <WeekRow
            key={week.id}
            week={week}
            block={block}
            blockIdx={focusedBlockIdx}
            weekIdx={wi}
            program={program}
            onPickDay={(coord) => setFocusedDay(coord)}
          />
        ))}
      </div>

      {focusedDay && (
        <DayFocusSheet
          coord={focusedDay}
          onClose={() => setFocusedDay(null)}
          onJump={handleJump}
        />
      )}
    </div>
  );
}

interface WeekRowProps {
  week: ProgramWeek;
  block: ProgramBlock;
  blockIdx: number;
  weekIdx: number;
  program: ReturnType<typeof useTrainingStore.getState>['program'];
  onPickDay: (coord: DayCoord) => void;
}

function WeekRow({ week, blockIdx, weekIdx, program, onPickDay }: WeekRowProps) {
  const isCurrentWeek =
    blockIdx === program.currentBlockIndex && weekIdx === program.currentWeekIndex;
  return (
    <div className={`pv-week ${isCurrentWeek ? 'is-current' : ''}`}>
      <div className="pv-week-rail">
        <div className="pv-week-label">
          <span className="pv-week-w">W</span>
          <span className="pv-week-num">{week.weekNumber}</span>
        </div>
        <div className="pv-week-line" />
      </div>
      <div className="pv-week-days">
        {week.days.map((d, di) => {
          const cursorHere = isCursor(program, blockIdx, weekIdx, di);
          const past = isPast(program, blockIdx, weekIdx, di);
          const main = d.exercises.find((pe) => pe.exercise.isMainLift);
          const setCount = d.exercises.reduce((s, pe) => s + pe.prescription.sets, 0);
          const cleanName = d.name.replace(/^Day\s*\d+\s*[—-]\s*/, '');
          return (
            <button
              key={d.id}
              type="button"
              className={`pv-day ${cursorHere ? 'is-cursor' : ''} ${past ? 'is-past' : ''}`}
              onClick={() => onPickDay({ bi: blockIdx, wi: weekIdx, di })}
            >
              <div className="pv-day-num">D{di + 1}</div>
              <div className="pv-day-body">
                <div className="pv-day-name">{cleanName}</div>
                <div className="pv-day-meta">
                  {main ? (
                    <span className="pv-day-main">{main.exercise.name}</span>
                  ) : (
                    <span className="pv-day-main pv-day-main--accessory">Accessories</span>
                  )}
                  <span className="pv-day-sep">·</span>
                  <span>{setCount} sets</span>
                </div>
              </div>
              {cursorHere && <span className="pv-day-here">YOU ARE HERE</span>}
              {past && (
                <span className="pv-day-tick">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path
                      d="M2 5.5l2.5 2.5 4.5-4.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DayFocusSheetProps {
  coord: DayCoord;
  onClose: () => void;
  onJump: (coord: DayCoord) => void;
}

function DayFocusSheet({ coord, onClose, onJump }: DayFocusSheetProps) {
  const { program } = useTrainingStore();
  const day: ProgramDay = program.blocks[coord.bi].weeks[coord.wi].days[coord.di];
  const cursorHere = isCursor(program, coord.bi, coord.wi, coord.di);
  const cleanName = day.name.replace(/^Day\s*\d+\s*[—-]\s*/, '');
  return (
    <div className="dfs-backdrop" onClick={onClose}>
      <div className="dfs-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="dfs-grab" />
        <div className="dfs-head">
          <div>
            <div className="dfs-eyebrow">
              Block {coord.bi + 1} · Week {program.blocks[coord.bi].weeks[coord.wi].weekNumber} · Day {coord.di + 1}
            </div>
            <h2 className="dfs-name">{cleanName}</h2>
          </div>
          <button type="button" className="dfs-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="dfs-list">
          {day.exercises.map((pe: ProgramExercise, idx: number) => (
            <div key={pe.exercise.id} className="dfs-row">
              <div className="dfs-row-num">{String(idx + 1).padStart(2, '0')}</div>
              <div className="dfs-row-body">
                <div className="dfs-row-name">
                  {pe.exercise.name}
                  {pe.exercise.isMainLift && (
                    <span className="dfs-main-mark" title="Main Lift">●</span>
                  )}
                </div>
                <div className="dfs-row-mg">{formatMuscles(pe.exercise)}</div>
              </div>
              <div className="dfs-row-rx">
                <span className="dfs-rx-sets">{pe.prescription.sets}</span>
                <span className="dfs-rx-x">×</span>
                <span className="dfs-rx-reps">{pe.prescription.reps}</span>
                {pe.prescription.rpeTarget != null && (
                  <span className="dfs-rx-rpe">@{pe.prescription.rpeTarget}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="dfs-actions">
          <button type="button" className="btn-primary" onClick={() => onJump(coord)}>
            {cursorHere ? 'Start this Session' : 'Switch Cursor → Train this Day'}
          </button>
        </div>
      </div>
    </div>
  );
}
