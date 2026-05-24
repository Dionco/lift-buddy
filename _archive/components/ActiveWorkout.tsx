import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import {
  Exercise as TrainingExercise,
  ExerciseLog,
  Session,
  SetLog,
} from '@/types/training';
import { e1rm as e1rmFn, lastTopSet, lastSessionSets } from '@/lib/e1rm';
import { AddExerciseSheet } from './AddExerciseSheet';
import { Swipeable } from './Swipeable';

// ─── Local UI shape ────────────────────────────────────────────────────────

interface UISet {
  id: string;
  weight: string;
  reps: string;
  rpe: number;
  done: boolean;
  programRPE?: number;
}

interface UIExercise {
  exId: number;
  exerciseId: string;
  name: string;
  isMainLift: boolean;
  muscles: string[];
  prescription?: { sets: number; reps: string; rpeTarget?: number };
  prevTop: SetLog | null;
  /** Completed sets from the most recent session that performed this exercise.
   *  Used by the PREVIOUS column on accessory lifts. */
  prevSets: SetLog[];
  sets: UISet[];
}

interface ActiveInput {
  exId: number;
  setId: string;
  field: 'weight' | 'reps';
}

function buildInitial(
  activeSessionExercises: ExerciseLog[] | undefined,
  programDayId: string | undefined,
  program: ReturnType<typeof useTrainingStore.getState>['program'],
  sessions: Session[],
): UIExercise[] {
  if (!activeSessionExercises) return [];
  const programDay =
    programDayId &&
    program.blocks[program.currentBlockIndex]?.weeks[program.currentWeekIndex]?.days[
      program.currentDayIndex
    ]?.id === programDayId
      ? program.blocks[program.currentBlockIndex].weeks[program.currentWeekIndex].days[
          program.currentDayIndex
        ]
      : undefined;

  return activeSessionExercises.map((log, exId) => {
    const pe = programDay?.exercises.find((p) => p.exercise.id === log.exercise.id);
    const prevTop = lastTopSet(sessions, log.exercise.id);
    const prevSets = lastSessionSets(sessions, log.exercise.id);
    // Pre-fill the editable buffer so the user can just confirm + log without
    // re-typing. Main lifts use TARGET (top weight × prescribed reps); accessory
    // lifts use PREVIOUS (per-set weight/reps/rpe from last session) so the
    // lifter can match what they did. The store keeps weight/reps at 0 until
    // they log — these strings are only the visible/editable buffer.
    const prescribedRepsLB = pe?.prescription?.reps?.match(/^(\d+)/)?.[1];
    const isMain = log.exercise.isMainLift;
    return {
      exId,
      exerciseId: log.exercise.id,
      name: log.exercise.name,
      isMainLift: isMain,
      muscles: log.exercise.primaryMuscles ?? [],
      prescription: pe?.prescription,
      prevTop,
      prevSets,
      sets: log.sets.map((s, i) => {
        const prevSet = prevSets[i];
        const fallbackWeight = isMain
          ? prevTop?.weight
          : (prevSet?.weight ?? prevTop?.weight);
        const fallbackReps = isMain
          ? prescribedRepsLB
          : (prevSet?.reps ? String(prevSet.reps) : prescribedRepsLB);
        const fallbackRpe =
          (!isMain && prevSet?.rpe) ||
          pe?.prescription?.rpeTarget ||
          7;
        return {
          id: `${exId}-${i + 1}`,
          weight:
            s.weight > 0
              ? String(s.weight)
              : fallbackWeight
                ? String(fallbackWeight)
                : '',
          reps:
            s.reps > 0
              ? String(s.reps)
              : fallbackReps ?? '',
          rpe: s.rpe || fallbackRpe,
          done: s.completed,
          programRPE: pe?.prescription?.rpeTarget,
        };
      }),
    };
  });
}

// Knowledge-base derived suggested rest seconds.
function suggestRest(reps: number, rpe: number): number {
  if (reps <= 5 && rpe >= 8) return 240;
  if (reps <= 8) return 180;
  if (reps <= 12) return 120;
  return 90;
}

function fmtTimerSec(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

const RPE_ROWS: { v: number; t: string }[] = [
  { v: 10, t: 'Max' },
  { v: 9.5, t: 'V.Hard' },
  { v: 9, t: 'V.Hard' },
  { v: 8.5, t: 'Hard' },
  { v: 8, t: 'Hard' },
  { v: 7.5, t: 'Mod+' },
  { v: 7, t: 'Mod' },
  { v: 6.5, t: 'Easy+' },
  { v: 6, t: 'Easy' },
];

// ─── Numpad v2 ─────────────────────────────────────────────────────────────

interface NumpadProps {
  visible: boolean;
  active: ActiveInput | null;
  exercises: UIExercise[];
  onKey: (key: string) => void;
  onClose: () => void;
  onLog: () => void;
  canLog: boolean;
  onSetField: (field: 'weight' | 'reps') => void;
  onInc: (delta: number) => void;
  onRpe: (rpe: number) => void;
  numpadRef: React.RefObject<HTMLDivElement>;
}

function Numpad({
  visible,
  active,
  exercises,
  onKey,
  onClose,
  onLog,
  canLog,
  onSetField,
  onInc,
  onRpe,
  numpadRef,
}: NumpadProps) {
  const previewSet = useMemo(() => {
    if (!active) return null;
    const ex = exercises.find((e) => e.exId === active.exId);
    return ex?.sets.find((s) => s.id === active.setId) ?? null;
  }, [active, exercises]);

  const activeEx = useMemo(
    () => (active ? exercises.find((e) => e.exId === active.exId) : null),
    [active, exercises],
  );
  const setIndex = useMemo(() => {
    if (!active || !activeEx) return 0;
    return activeEx.sets.findIndex((s) => s.id === active.setId);
  }, [active, activeEx]);

  const liveE1RM =
    previewSet && previewSet.weight && previewSet.reps
      ? e1rmFn(parseFloat(previewSet.weight), parseInt(previewSet.reps, 10), previewSet.rpe)
      : 0;

  const targetStr = activeEx
    ? `${activeEx.prevTop?.weight ? `${activeEx.prevTop.weight}kg · ` : ''}${
        activeEx.prescription?.reps ?? '—'
      }${
        activeEx.prescription?.rpeTarget != null ? ` @${activeEx.prescription.rpeTarget}` : ''
      }`
    : '';

  return (
    <div ref={numpadRef} data-numpad className={`np2 ${visible ? 'is-visible' : ''}`}>
      <div className="np2-head">
        <div className="np2-head-set">
          <div className="np2-head-eyebrow">
            SET {setIndex + 1} OF {activeEx?.sets.length ?? 0}
          </div>
          <div className="np2-head-name">{activeEx?.name ?? '—'}</div>
        </div>
        {activeEx?.prescription && (
          <div className="np2-head-target">
            <span className="lbl">TARGET</span>
            <span>{targetStr}</span>
          </div>
        )}
        <button type="button" className="np2-close" onClick={onClose} aria-label="Close numpad">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="np2-vals">
        <button
          type="button"
          className={`np2-val np2-val--w is-field ${active?.field === 'weight' ? 'is-active' : ''}`}
          onClick={() => onSetField('weight')}
        >
          <span className="np2-val-lbl">WEIGHT</span>
          <span className={`np2-val-num ${!previewSet?.weight ? 'is-empty' : ''}`}>
            {previewSet?.weight || '—'}
            <span className="u">kg</span>
          </span>
        </button>
        <button
          type="button"
          className={`np2-val np2-val--r is-field ${active?.field === 'reps' ? 'is-active' : ''}`}
          onClick={() => onSetField('reps')}
        >
          <span className="np2-val-lbl">REPS</span>
          <span className={`np2-val-num ${!previewSet?.reps ? 'is-empty' : ''}`}>
            {previewSet?.reps || '—'}
          </span>
        </button>
        <div className="np2-val np2-val--e1rm">
          <span className="np2-val-lbl">EST. 1RM</span>
          <span className={`np2-val-num ${!liveE1RM ? 'is-empty' : ''}`}>
            {liveE1RM > 0 ? liveE1RM.toFixed(1) : '—'}
            {liveE1RM > 0 && <span className="u">kg</span>}
          </span>
        </div>
      </div>

      <div className="np2-incs">
        <button type="button" className="np2-inc is-neg" onClick={() => onInc(-5)}>−5</button>
        <button type="button" className="np2-inc is-neg" onClick={() => onInc(-2.5)}>−2.5</button>
        <button type="button" className="np2-inc is-neg" onClick={() => onInc(-1)}>−1</button>
        <button type="button" className="np2-inc" onClick={() => onInc(1)}>+1</button>
        <button type="button" className="np2-inc" onClick={() => onInc(2.5)}>+2.5</button>
        <button type="button" className="np2-inc" onClick={() => onInc(5)}>+5</button>
      </div>

      <div className="np2-body">
        <div className="np2-keys">
          {['1','2','3','4','5','6','7','8','9'].map((k) => (
            <button key={k} type="button" className="np2-key" onClick={() => onKey(k)}>
              {k}
            </button>
          ))}
          <button type="button" className="np2-key is-dot" onClick={() => onKey('.')}>·</button>
          <button type="button" className="np2-key" onClick={() => onKey('0')}>0</button>
          <button type="button" className="np2-key is-back" onClick={() => onKey('back')} aria-label="Backspace">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <path d="M6 1L1 7l5 6h11V1H6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M9 5l4 4M13 5l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="np2-rpe">
          <div className="np2-rpe-head">
            <span className="lbl">RPE</span>
            <span className="val">{previewSet?.rpe ?? '—'}</span>
          </div>
          <div className="np2-rpe-list">
            {RPE_ROWS.map(({ v, t }) => (
              <button
                key={v}
                type="button"
                className={`np2-rpe-row ${previewSet?.rpe === v ? 'is-active' : ''}`}
                onClick={() => onRpe(v)}
              >
                <span className="n">{v}</span>
                <span className="t">{t}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="np2-foot">
        <button type="button" className="np2-log" onClick={onLog} disabled={!canLog}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3.5 3.5L12 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Log set <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Exercise block v2 ─────────────────────────────────────────────────────

interface SetRowProps {
  ex: UIExercise;
  set: UISet;
  setIdx: number;
  active: ActiveInput | null;
  onFocus: (setId: string, field: 'weight' | 'reps') => void;
  onToggleDone: (setId: string) => void;
  onApplyTarget: (setId: string) => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}

function SetRow({ ex, set, setIdx, active, onFocus, onToggleDone, onApplyTarget, rowRef }: SetRowProps) {
  const isWA = active?.exId === ex.exId && active.setId === set.id && active.field === 'weight';
  const isRA = active?.exId === ex.exId && active.setId === set.id && active.field === 'reps';
  const isActive = isWA || isRA;
  const isDone = set.done;
  const prevSet = ex.prevSets[setIdx];

  // Main lifts show the prescribed TARGET (top weight × reps @rpe). Accessory
  // lifts show what was performed for the same set last time (PREVIOUS), so the
  // lifter can match it.
  const targetContent = ex.isMainLift ? (
    ex.prescription ? (
      <>
        {ex.prevTop && <span className="w">{ex.prevTop.weight}</span>}
        <span className="x">×</span>
        <span className="reps">{ex.prescription.reps}</span>
        {ex.prescription.rpeTarget != null && (
          <span className="rpe">@{ex.prescription.rpeTarget}</span>
        )}
      </>
    ) : (
      <span className="empty">—</span>
    )
  ) : prevSet ? (
    <>
      <span className="w">{prevSet.weight}</span>
      <span className="x">×</span>
      <span className="reps">{prevSet.reps}</span>
      <span className="rpe">@{prevSet.rpe}</span>
    </>
  ) : (
    <span className="empty">—</span>
  );

  const targetTitle = ex.isMainLift
    ? ex.prevTop
      ? `Tap to use previous: ${ex.prevTop.weight}kg × ${ex.prescription?.reps ?? ex.prevTop.reps}`
      : 'Tap to apply target'
    : prevSet
      ? `Tap to use previous: ${prevSet.weight}kg × ${prevSet.reps} @${prevSet.rpe}`
      : 'No previous set';

  return (
    <div
      ref={rowRef}
      className={`r2 ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
      onClick={() => onFocus(set.id, 'weight')}
    >
      <div className="r2-num">{setIdx + 1}</div>
      <button
        type="button"
        className="r2-target"
        onClick={(e) => {
          e.stopPropagation();
          onApplyTarget(set.id);
        }}
        title={targetTitle}
      >
        {targetContent}
      </button>
      <button
        data-set-input
        type="button"
        className={`r2-cell ${set.weight ? 'has-val' : ''} ${isWA ? 'is-active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onFocus(set.id, 'weight');
        }}
      >
        {set.weight || '—'}
      </button>
      <button
        data-set-input
        type="button"
        className={`r2-cell ${set.reps ? 'has-val' : ''} ${isRA ? 'is-active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onFocus(set.id, 'reps');
        }}
      >
        {set.reps || '—'}
      </button>
      <div className={`r2-cell r2-cell--rpe ${isDone ? 'has-val' : ''}`}>
        {isDone || set.weight || set.reps ? set.rpe : '—'}
      </div>
      <button
        type="button"
        className="r2-check"
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(set.id);
        }}
        aria-label="Mark set complete"
      >
        {isDone && (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              d="M2 6.5l3 3 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

interface ExerciseBlockProps {
  ex: UIExercise;
  active: ActiveInput | null;
  onFocus: (setId: string, field: 'weight' | 'reps') => void;
  onToggleDone: (setId: string) => void;
  onAddSet: () => void;
  onApplyTarget: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

function ExerciseBlock({
  ex,
  active,
  onFocus,
  onToggleDone,
  onAddSet,
  onApplyTarget,
  onDeleteSet,
  rowRefs,
}: ExerciseBlockProps) {
  const isCurrent = active?.exId === ex.exId;

  return (
    <div className={`eb2 ${ex.isMainLift ? 'is-main' : ''} ${isCurrent ? 'is-current' : ''}`}>
      <div className="eb2-head">
        <div className="eb2-head-l">
          <div className="eb2-eyebrow">
            {ex.isMainLift && <span className="tag">MAIN</span>}
            {ex.muscles.length > 0 && (
              <span className="mg">{ex.muscles.join(' · ').toUpperCase()}</span>
            )}
          </div>
          <div className="eb2-name">{ex.name}</div>
        </div>
        {ex.prescription && (
          <span className="eb2-rx">
            {ex.prescription.sets}×{ex.prescription.reps}
            {ex.prescription.rpeTarget != null ? ` @${ex.prescription.rpeTarget}` : ''}
          </span>
        )}
        <button type="button" className="eb2-more" aria-label="More">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="2.5" cy="7" r="1" fill="currentColor" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
            <circle cx="11.5" cy="7" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {ex.prevTop && (
        <div className="eb2-meta">
          <div className="top">
            <span className="lbl">LAST</span>
            <span className="val">{ex.prevTop.weight}</span>
            <span className="u">
              kg · {ex.prevTop.reps} reps · @{ex.prevTop.rpe}
            </span>
          </div>
        </div>
      )}

      <div className="eb2-rows">
        <div className="r2-cols">
          <span>SET</span>
          <span>{ex.isMainLift ? 'TARGET' : 'PREVIOUS'}</span>
          <span>KG</span>
          <span>REPS</span>
          <span>RPE</span>
          <span></span>
        </div>
        {ex.sets.map((s, i) => {
          const isExtraSet =
            !ex.prescription || i >= (ex.prescription?.sets ?? Number.POSITIVE_INFINITY);
          const row = (
            <SetRow
              ex={ex}
              set={s}
              setIdx={i}
              active={active}
              onFocus={onFocus}
              onToggleDone={onToggleDone}
              onApplyTarget={onApplyTarget}
              rowRef={(el) => {
                const k = `${ex.exId}-${s.id}`;
                if (el) rowRefs.current[k] = el;
                else delete rowRefs.current[k];
              }}
            />
          );
          if (!isExtraSet) return <div key={s.id}>{row}</div>;
          return (
            <Swipeable key={s.id} onDelete={() => onDeleteSet(s.id)} trackClassName="r2-swipe">
              {row}
            </Swipeable>
          );
        })}
      </div>

      <button type="button" className="eb2-addset" onClick={onAddSet}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        ADD SET
      </button>
    </div>
  );
}

// ─── Rest pill ─────────────────────────────────────────────────────────────

interface RestPillProps {
  remaining: number;
  running: boolean;
  suggested: number;
  onToggle: () => void;
}

function RestPill({ remaining, running, suggested, onToggle }: RestPillProps) {
  if (remaining === 0 && !running) {
    return (
      <button
        type="button"
        className="ses-rest-pill"
        onClick={onToggle}
        title={`Suggested: ${fmtTimerSec(suggested)}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2M9 2h6" />
        </svg>
        <span className="suggest">REST</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`ses-rest-pill ${running ? 'is-running' : ''}`}
      onClick={onToggle}
    >
      {running ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z" /></svg>
      )}
      <span className="val">{fmtTimerSec(remaining)}</span>
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export interface SessionStats {
  doneSets: number;
  totalSets: number;
  currentExerciseName?: string;
}

interface ActiveWorkoutProps {
  onFinish: () => void;
  onMinimize?: () => void;
  onDragStart?: () => void;
  onDrag?: (dy: number) => void;
  onDragEnd?: (dy: number) => void;
  onStatsChange?: (stats: SessionStats) => void;
  showDragHandle?: boolean;
}

export function ActiveWorkout({
  onFinish,
  onMinimize,
  onDragStart,
  onDrag,
  onDragEnd,
  onStatsChange,
  showDragHandle = true,
}: ActiveWorkoutProps) {
  const activeSession = useTrainingStore((s) => s.activeSession);
  const sessions = useTrainingStore((s) => s.sessions);
  const program = useTrainingStore((s) => s.program);
  const addExerciseToStore = useTrainingStore((s) => s.addExercise);
  const updateSetInStore = useTrainingStore((s) => s.updateSet);
  const addSetToStore = useTrainingStore((s) => s.addSetToExercise);
  const removeSetFromStore = useTrainingStore((s) => s.removeSet);
  const removeExerciseFromStore = useTrainingStore((s) => s.removeExercise);

  const [exercises, setExercises] = useState<UIExercise[]>(() =>
    buildInitial(activeSession?.exercises, activeSession?.programDayId, program, sessions),
  );
  const [active, setActive] = useState<ActiveInput | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);

  // Resync local state when the store's exercise list changes shape (add, remove,
  // or session change). Use a fingerprint of exercise ids so a delete-then-add
  // of equal count still triggers a rebuild.
  const sessionIdRef = useRef(activeSession?.id);
  const exerciseFingerprintRef = useRef(
    activeSession?.exercises.map((e) => e.exercise.id).join('|') ?? '',
  );
  useEffect(() => {
    if (!activeSession) return;
    const fingerprint = activeSession.exercises.map((e) => e.exercise.id).join('|');
    const sessionChanged = sessionIdRef.current !== activeSession.id;
    const exercisesChanged = exerciseFingerprintRef.current !== fingerprint;
    if (sessionChanged || exercisesChanged) {
      setExercises(
        buildInitial(activeSession.exercises, activeSession.programDayId, program, sessions),
      );
      sessionIdRef.current = activeSession.id;
      exerciseFingerprintRef.current = fingerprint;
    }
  }, [activeSession, program, sessions]);

  const formattedTime = useElapsedTime(activeSession?.startTime ?? Date.now());

  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
  const doneSets = exercises.reduce((s, e) => s + e.sets.filter((x) => x.done).length, 0);
  const progressPct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;
  const currentExName = active
    ? exercises.find((e) => e.exId === active.exId)?.name
    : exercises.find((e) => e.sets.some((s) => !s.done))?.name ?? exercises[0]?.name;

  // Bubble stats up so the mini bar reflects them.
  useEffect(() => {
    onStatsChange?.({ doneSets, totalSets, currentExerciseName: currentExName });
  }, [doneSets, totalSets, currentExName, onStatsChange]);

  const setIndexFromId = (setId: string): number => {
    const parts = setId.split('-');
    const n = parseInt(parts[1] ?? '1', 10);
    return Number.isFinite(n) ? n - 1 : 0;
  };

  const updateSetLocal = (exId: number, setId: string, patch: Partial<UISet>) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.exId !== exId
          ? ex
          : { ...ex, sets: ex.sets.map((s) => (s.id !== setId ? s : { ...s, ...patch })) },
      ),
    );
  };

  // When the user focuses a cell, the existing value is shown but the next
  // numeric/dot keystroke replaces it (iOS calculator pattern). This way the
  // pre-filled target weight is ready to log as-is, but easy to override too.
  const replaceOnKeyRef = useRef(true);

  const handleFocus = (exId: number, setId: string, field: 'weight' | 'reps') => {
    setActive({ exId, setId, field });
    replaceOnKeyRef.current = true;
  };

  const handleToggleDone = (exId: number, setId: string) => {
    let nextDone = false;
    setExercises((prev) =>
      prev.map((ex) =>
        ex.exId !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => {
                if (s.id !== setId) return s;
                nextDone = !s.done;
                return { ...s, done: nextDone };
              }),
            },
      ),
    );
    const ex = exercises.find((e) => e.exId === exId);
    const set = ex?.sets.find((s) => s.id === setId);
    const setIndex = setIndexFromId(setId);
    const updates: Partial<SetLog> = { completed: nextDone };
    if (set) {
      const w = parseFloat(set.weight);
      const r = parseInt(set.reps, 10);
      if (Number.isFinite(w)) updates.weight = w;
      if (Number.isFinite(r)) updates.reps = r;
      updates.rpe = set.rpe;
      updates.timestamp = Date.now();
    }
    updateSetInStore(exId, setIndex, updates);

    if (nextDone && set) {
      const r = parseInt(set.reps, 10);
      if (Number.isFinite(r) && r > 0) {
        const rest = suggestRest(r, set.rpe);
        setRestSuggested(rest);
        setRestRemaining(rest);
        setRestRunning(false); // manual start
      }
    }
  };

  const handleAddSet = (exId: number) => {
    addSetToStore(exId);
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exId !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const n = ex.sets.length + 1;
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: `${exId}-${n}`,
              weight: last?.weight ?? '',
              reps: '',
              rpe: last?.rpe ?? ex.prescription?.rpeTarget ?? 7,
              done: false,
              programRPE: ex.prescription?.rpeTarget,
            },
          ],
        };
      }),
    );
  };

  const handleDeleteSet = (exId: number, setId: string) => {
    const setIndex = setIndexFromId(setId);
    removeSetFromStore(exId, setIndex);
    setExercises((prev) =>
      prev.map((ex) =>
        ex.exId !== exId ? ex : { ...ex, sets: ex.sets.filter((s) => s.id !== setId) },
      ),
    );
    setActive((cur) => (cur && cur.exId === exId && cur.setId === setId ? null : cur));
  };

  const handleDeleteExercise = (exId: number) => {
    removeExerciseFromStore(exId);
    setActive((cur) => (cur && cur.exId === exId ? null : cur));
  };

  const handleApplyTarget = (exId: number, setId: string) => {
    const ex = exercises.find((e) => e.exId === exId);
    if (!ex) return;
    const setIndex = setIndexFromId(setId);
    // Accessory lifts pull from the matching set of the previous session; main
    // lifts pull from the prescription (sets × prescribed reps @ rpeTarget,
    // with weight from the previous top set).
    const prevSet = !ex.isMainLift ? ex.prevSets[setIndex] : undefined;
    const weight = prevSet
      ? String(prevSet.weight)
      : ex.prevTop
        ? String(ex.prevTop.weight)
        : '';
    const reps = prevSet
      ? String(prevSet.reps)
      : ex.prescription?.reps ?? (ex.prevTop ? String(ex.prevTop.reps) : '');
    const repsParsed = parseInt(reps, 10);
    const rpe =
      prevSet?.rpe ?? ex.prescription?.rpeTarget ?? ex.prevTop?.rpe ?? 7;
    updateSetLocal(exId, setId, { weight, reps, rpe });
    const patch: Partial<SetLog> = { rpe };
    if (prevSet) patch.weight = prevSet.weight;
    else if (ex.prevTop) patch.weight = ex.prevTop.weight;
    if (Number.isFinite(repsParsed)) patch.reps = repsParsed;
    updateSetInStore(exId, setIndex, patch);
  };

  const getAllInputs = useCallback((): ActiveInput[] => {
    const inputs: ActiveInput[] = [];
    exercises.forEach((ex) => {
      ex.sets.forEach((set) => {
        inputs.push({ exId: ex.exId, setId: set.id, field: 'weight' });
        inputs.push({ exId: ex.exId, setId: set.id, field: 'reps' });
      });
    });
    return inputs;
  }, [exercises]);

  const handleNumpadKey = (key: string) => {
    if (!active) return;
    const { exId, setId, field } = active;
    const shouldReplace = replaceOnKeyRef.current;
    let nextValue = '';
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exId !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            const cur = s[field];
            let next: string;
            if (key === 'back') {
              next = cur.slice(0, -1);
            } else if (key === '.') {
              if (field === 'reps') return s;
              if (shouldReplace) next = '0.';
              else if (cur.includes('.')) return s;
              else next = cur + '.';
            } else {
              // Numeric key — first press after focus replaces the (possibly
              // pre-filled) value so the user can just type their own.
              next = shouldReplace ? key : cur + key;
            }
            nextValue = next;
            return { ...s, [field]: next };
          }),
        };
      }),
    );
    replaceOnKeyRef.current = false;
    const setIndex = setIndexFromId(setId);
    const numeric = field === 'weight' ? parseFloat(nextValue) : parseInt(nextValue, 10);
    if (Number.isFinite(numeric)) {
      updateSetInStore(exId, setIndex, { [field]: numeric });
    } else if (nextValue === '') {
      updateSetInStore(exId, setIndex, { [field]: 0 });
    }
  };

  const handleInc = (delta: number) => {
    if (!active) return;
    const { exId, setId, field } = active;
    let nextValue = '';
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exId !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            if (field === 'weight') {
              const v = parseFloat(s.weight) || 0;
              const next = Math.max(0, +(v + delta).toFixed(2));
              nextValue = String(next);
              return { ...s, weight: nextValue };
            }
            const v = parseInt(s.reps, 10) || 0;
            const next = Math.max(0, v + Math.round(delta));
            nextValue = String(next);
            return { ...s, reps: nextValue };
          }),
        };
      }),
    );
    replaceOnKeyRef.current = false;
    const setIndex = setIndexFromId(setId);
    const numeric = field === 'weight' ? parseFloat(nextValue) : parseInt(nextValue, 10);
    if (Number.isFinite(numeric)) {
      updateSetInStore(exId, setIndex, { [field]: numeric });
    }
  };

  const handleRPE = (rpe: number) => {
    if (!active) return;
    updateSetLocal(active.exId, active.setId, { rpe });
    const setIndex = setIndexFromId(active.setId);
    updateSetInStore(active.exId, setIndex, { rpe });
  };

  const handleLogActive = () => {
    if (!active) return;
    const ex = exercises.find((e) => e.exId === active.exId);
    const set = ex?.sets.find((s) => s.id === active.setId);
    if (!set || !parseFloat(set.weight) || !parseInt(set.reps, 10)) return;
    // Mark done, persist, suggest rest, advance to next set.
    updateSetLocal(active.exId, active.setId, { done: true });
    const setIndex = setIndexFromId(active.setId);
    updateSetInStore(active.exId, setIndex, {
      completed: true,
      weight: parseFloat(set.weight),
      reps: parseInt(set.reps, 10),
      rpe: set.rpe,
      timestamp: Date.now(),
    });
    const rest = suggestRest(parseInt(set.reps, 10), set.rpe);
    setRestSuggested(rest);
    setRestRemaining(rest);
    setRestRunning(false);
    // Advance to next set within block, else first set of next block.
    const all = getAllInputs().filter((i) => i.field === 'weight');
    const idx = all.findIndex((i) => i.exId === active.exId && i.setId === active.setId);
    if (idx >= 0 && idx < all.length - 1) {
      setActive(all[idx + 1]);
    }
  };

  const activeSet = active
    ? exercises.find((e) => e.exId === active.exId)?.sets.find((s) => s.id === active.setId) ?? null
    : null;
  const canLog = !!(
    activeSet &&
    parseFloat(activeSet.weight) > 0 &&
    parseInt(activeSet.reps, 10) > 0
  );

  // Auto-scroll active row into view above the numpad.
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const stackRef = useRef<HTMLDivElement>(null);
  const numpadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const k = `${active.exId}-${active.setId}`;
    const row = rowRefs.current[k];
    const stack = stackRef.current;
    if (!row || !stack) return;
    const id = requestAnimationFrame(() => {
      const stackRect = stack.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const npEl = numpadRef.current;
      const numpadOpen = npEl?.classList.contains('is-visible');
      const numpadHeight = numpadOpen ? npEl?.offsetHeight ?? 480 : 0;
      const headroom = 56;
      const buffer = 20;
      const visibleTop = stackRect.top + headroom;
      const visibleBottom = stackRect.bottom - numpadHeight - buffer;
      if (rowRect.top < visibleTop) {
        stack.scrollBy({ top: rowRect.top - visibleTop, behavior: 'smooth' });
      } else if (rowRect.bottom > visibleBottom) {
        stack.scrollBy({ top: rowRect.bottom - visibleBottom, behavior: 'smooth' });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  // Manual rest timer.
  const [restRemaining, setRestRemaining] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restSuggested, setRestSuggested] = useState(180);
  useEffect(() => {
    if (!restRunning) return;
    const t = setInterval(() => {
      setRestRemaining((s) => {
        if (s <= 1) {
          setRestRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [restRunning]);

  // Drag-down gesture handlers — parent decides what the drag does.
  const dragState = useRef<{ active: boolean; startY: number }>({ active: false, startY: 0 });
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3200);
    return () => clearTimeout(t);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragState.current = { active: true, startY: e.clientY };
    onDragStart?.();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // pointer capture may not be supported
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.active) return;
    const dy = Math.max(0, e.clientY - dragState.current.startY);
    onDrag?.(dy);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragState.current.active) return;
    const dy = Math.max(0, e.clientY - dragState.current.startY);
    dragState.current.active = false;
    onDragEnd?.(dy);
  };

  const handleAddExercises = (newExercises: TrainingExercise[]) => {
    if (!activeSession) return;
    newExercises.forEach((ex) => {
      addExerciseToStore({ exercise: ex, sets: [] });
    });
    setShowAddExercise(false);
  };

  const cleanName =
    activeSession?.workoutName?.replace(/^Week\s*\d+\s*[·-]\s*Day\s*\d+\s*[—-]\s*/, '') ??
    activeSession?.workoutName ??
    'Session';

  return (
    <div
      className="active-session"
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (!t.closest('[data-numpad]') && !t.closest('[data-set-input]')) setActive(null);
      }}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      {showDragHandle && (
        <div
          className={`as-grab ${showHint ? 'show-hint' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="as-grab-bar" />
          <span className="as-grab-hint">Drag down to minimize</span>
        </div>
      )}

      <div className="ses-top">
        <button
          type="button"
          className="ses-top-back"
          onClick={onMinimize ?? onFinish}
          aria-label="Minimize"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div className="ses-top-meta">
          <div className="ses-top-eyebrow">
            <span>SESSION IN PROGRESS</span>
          </div>
          <div className="ses-top-day">{cleanName}</div>
        </div>
        <button type="button" className="ses-top-finish" onClick={onFinish}>
          Finish
        </button>
      </div>

      <div className="ses-strip">
        <div className="ses-strip-time">
          <span className="ses-strip-time-dot" />
          <span className="ses-strip-time-val">{formattedTime}</span>
        </div>
        <div className="ses-strip-progress">
          <div className="ses-strip-bar">
            <div className="ses-strip-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="ses-strip-label">
            <span className="v">{doneSets}</span>
            <span>/ {totalSets}</span>
            <span className="sep">·</span>
            <span>{totalSets > 0 ? Math.round(progressPct) : 0}%</span>
          </div>
        </div>
        <RestPill
          remaining={restRemaining}
          running={restRunning}
          suggested={restSuggested}
          onToggle={() => {
            if (restRemaining === 0) {
              setRestRemaining(restSuggested);
              setRestRunning(true);
            } else {
              setRestRunning((r) => !r);
            }
          }}
        />
      </div>

      <div
        className="ses-stack"
        ref={stackRef}
        style={{ paddingBottom: active ? 520 : 96 }}
      >
        {exercises.map((ex) => {
          const block = (
            <ExerciseBlock
              ex={ex}
              active={active}
              onFocus={(setId, field) => handleFocus(ex.exId, setId, field)}
              onToggleDone={(setId) => handleToggleDone(ex.exId, setId)}
              onAddSet={() => handleAddSet(ex.exId)}
              onApplyTarget={(setId) => handleApplyTarget(ex.exId, setId)}
              onDeleteSet={(setId) => handleDeleteSet(ex.exId, setId)}
              rowRefs={rowRefs}
            />
          );
          if (ex.prescription) return <div key={ex.exId}>{block}</div>;
          return (
            <Swipeable
              key={ex.exId}
              onDelete={() => handleDeleteExercise(ex.exId)}
              className="xb-swipe-shell"
              revealWidth={96}
            >
              {block}
            </Swipeable>
          );
        })}
        <button
          type="button"
          className="as-add-ex"
          onClick={() => setShowAddExercise(true)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Add Exercise
        </button>
      </div>

      <Numpad
        visible={active !== null}
        active={active}
        exercises={exercises}
        onKey={handleNumpadKey}
        onClose={() => setActive(null)}
        onLog={handleLogActive}
        canLog={canLog}
        onSetField={(field) => {
          if (!active) return;
          setActive({ ...active, field });
          replaceOnKeyRef.current = true;
        }}
        onInc={handleInc}
        onRpe={handleRPE}
        numpadRef={numpadRef}
      />

      <AddExerciseSheet
        visible={showAddExercise}
        sessions={sessions}
        existingIds={exercises.map((e) => e.exerciseId)}
        onClose={() => setShowAddExercise(false)}
        onAdd={handleAddExercises}
      />
    </div>
  );
}
