import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTrainingStore } from '@/store/useTrainingStore';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import {
  Exercise as TrainingExercise,
  ExerciseLog,
  Session,
  SetLog,
  calculateE1RM,
} from '@/types/training';
import { lastTopSet } from '@/lib/topSet';
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
  prescription?: { sets: number; reps: string; rpeTarget?: number };
  prevTop: SetLog | null;
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
    return {
      exId,
      exerciseId: log.exercise.id,
      name: log.exercise.name,
      isMainLift: log.exercise.isMainLift,
      prescription: pe?.prescription,
      prevTop,
      sets: log.sets.map((s, i) => ({
        id: `${exId}-${i + 1}`,
        weight: s.weight > 0 ? String(s.weight) : '',
        reps: s.reps > 0 ? String(s.reps) : '',
        rpe: s.rpe || pe?.prescription?.rpeTarget || 7,
        done: s.completed,
        programRPE: pe?.prescription?.rpeTarget,
      })),
    };
  });
}

// ─── Numpad ────────────────────────────────────────────────────────────────

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;
const RPE_LABELS: Record<number, string> = {
  6: 'Moderate',
  6.5: 'Moderate',
  7: 'Vigorous',
  7.5: 'Vigorous',
  8: 'Hard',
  8.5: 'Hard',
  9: 'Very Hard',
  9.5: 'Very Hard',
  10: 'Max Effort',
};

interface NumpadProps {
  visible: boolean;
  active: ActiveInput | null;
  exercises: UIExercise[];
  onKey: (key: string) => void;
  onHide: () => void;
  onNext: () => void;
  onRPE: (rpe: number) => void;
}

function Numpad({ visible, active, exercises, onKey, onHide, onNext, onRPE }: NumpadProps) {
  const [showRPE, setShowRPE] = useState(false);

  const previewSet = useMemo(() => {
    if (!active) return null;
    const ex = exercises.find((e) => e.exId === active.exId);
    return ex?.sets.find((s) => s.id === active.setId) ?? null;
  }, [active, exercises]);

  const liveE1RM =
    previewSet && previewSet.weight && previewSet.reps
      ? calculateE1RM(parseFloat(previewSet.weight), parseInt(previewSet.reps, 10), previewSet.rpe)
      : 0;

  const fieldVal = previewSet && active ? previewSet[active.field] : '';

  return (
    <div data-numpad className={`np ${visible ? 'is-visible' : ''}`}>
      <div className="np-preview">
        <div className="np-preview-block">
          <div className="np-preview-label">{active?.field === 'reps' ? 'Reps' : 'Weight'}</div>
          <div className="np-preview-val">
            {fieldVal || '—'}
            {active?.field === 'weight' && previewSet?.weight && (
              <span className="np-preview-unit">kg</span>
            )}
          </div>
        </div>
        <div className="np-preview-block">
          <div className="np-preview-label">RPE</div>
          <div className="np-preview-val">{previewSet?.rpe ?? '—'}</div>
        </div>
        <div className="np-preview-block np-preview-e1rm">
          <div className="np-preview-label">e1RM</div>
          <div className="np-preview-val">
            {liveE1RM > 0 ? liveE1RM.toFixed(1) : '—'}
            {liveE1RM > 0 && <span className="np-preview-unit">kg</span>}
          </div>
        </div>
      </div>

      <div className="np-toolbar">
        <button type="button" className="np-tool" onClick={onHide}>
          Done
        </button>
        <button
          type="button"
          className="np-tool np-tool--rpe"
          onClick={() => setShowRPE((s) => !s)}
        >
          <span className="np-tool-rpe-label">RPE</span>
          <span className="np-tool-rpe-val">{previewSet?.rpe ?? '—'}</span>
        </button>
        <button type="button" className="np-tool np-tool--next" onClick={onNext}>
          Next →
        </button>
      </div>

      {showRPE ? (
        <div className="np-rpe-grid">
          {RPE_VALUES.map((rpe) => (
            <button
              key={rpe}
              type="button"
              className={`np-rpe-btn ${previewSet?.rpe === rpe ? 'is-active' : ''}`}
              onClick={() => {
                onRPE(rpe);
                setShowRPE(false);
              }}
            >
              <span className="np-rpe-num">{rpe}</span>
              <span className="np-rpe-tag">{RPE_LABELS[rpe]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="np-keys-grid">
          {(['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`np-key ${k === 'back' ? 'is-back' : ''} ${k === '.' ? 'is-dot' : ''}`}
              onClick={() => onKey(k)}
            >
              {k === 'back' ? (
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                  <path d="M6 1L1 7l5 6h11V1H6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M9 5l4 4M13 5l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              ) : (
                k
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Exercise block ────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  ex: UIExercise;
  active: ActiveInput | null;
  onFocus: (setId: string, field: 'weight' | 'reps') => void;
  onToggleDone: (setId: string) => void;
  onAddSet: () => void;
  onApplyTarget: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
}

function ExerciseBlock({ ex, active, onFocus, onToggleDone, onAddSet, onApplyTarget, onDeleteSet }: ExerciseBlockProps) {
  const topE1RM = ex.sets.reduce((best, s) => {
    if (!s.done) return best;
    const w = parseFloat(s.weight);
    const r = parseInt(s.reps, 10);
    if (!Number.isFinite(w) || !Number.isFinite(r)) return best;
    const e = calculateE1RM(w, r, s.rpe);
    return e > best ? e : best;
  }, 0);

  return (
    <div className={`xb ${ex.isMainLift ? 'is-main' : ''}`}>
      <div className="xb-head">
        <div className="xb-head-left">
          {ex.isMainLift && <span className="xb-tag">Main</span>}
          <h2 className="xb-name">{ex.name}</h2>
        </div>
        <button type="button" className="xb-more" aria-label="More">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="2.5" cy="7" r="1" fill="currentColor" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
            <circle cx="11.5" cy="7" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {topE1RM > 0 && (
        <div className="xb-meta">
          <span className="xb-e1rm">
            <span className="xb-e1rm-label">Top e1RM</span>
            <span className="xb-e1rm-val">{topE1RM.toFixed(1)}</span>
            <span className="xb-e1rm-unit">kg</span>
          </span>
        </div>
      )}

      <div className="xb-cols">
        <span className="xb-col-set">Set</span>
        <span className="xb-col-target">Target</span>
        <span className="xb-col-input">Weight</span>
        <span className="xb-col-input">Reps</span>
        <span className="xb-col-rpe">RPE</span>
        <span className="xb-col-done" />
      </div>

      {ex.sets.map((s, i) => {
        const isWA = active?.exId === ex.exId && active.setId === s.id && active.field === 'weight';
        const isRA = active?.exId === ex.exId && active.setId === s.id && active.field === 'reps';
        const w = parseFloat(s.weight);
        const r = parseInt(s.reps, 10);
        const e1rm =
          Number.isFinite(w) && Number.isFinite(r) && w > 0 && r > 0 ? calculateE1RM(w, r, s.rpe) : 0;
        // A set is "non-programmed" when there's no prescription, or when its
        // index is past the prescribed set count (i.e. user-added via Add Set).
        const isExtraSet =
          !ex.prescription || i >= (ex.prescription?.sets ?? Number.POSITIVE_INFINITY);
        const rowInner = (
          <div className={`xb-row ${s.done ? 'is-done' : ''} ${isWA || isRA ? 'is-active' : ''}`}>
            <div className="xb-set-num">{i + 1}</div>
            <button
              type="button"
              className="xb-target"
              onClick={(e) => {
                e.stopPropagation();
                onApplyTarget(s.id);
              }}
              title={
                ex.prevTop
                  ? `Tap to use previous: ${ex.prevTop.weight}kg × ${ex.prescription?.reps ?? ex.prevTop.reps}`
                  : 'Tap to apply target'
              }
            >
              {ex.prescription ? (
                <>
                  {ex.prevTop && (
                    <span className="xb-target-w">
                      {ex.prevTop.weight}
                      <span className="xb-target-unit">kg</span>
                    </span>
                  )}
                  <span className="xb-target-x">×</span>
                  <span className="xb-target-reps">{ex.prescription.reps}</span>
                  {ex.prescription.rpeTarget != null && (
                    <span className="xb-target-rpe">@{ex.prescription.rpeTarget}</span>
                  )}
                </>
              ) : (
                <span className="xb-target-empty">—</span>
              )}
            </button>
            <button
              data-set-input
              type="button"
              className={`xb-input ${isWA ? 'is-active' : ''} ${s.weight ? 'has-val' : ''}`}
              onClick={() => onFocus(s.id, 'weight')}
            >
              {s.weight || <span className="xb-ph">kg</span>}
            </button>
            <button
              data-set-input
              type="button"
              className={`xb-input ${isRA ? 'is-active' : ''} ${s.reps ? 'has-val' : ''}`}
              onClick={() => onFocus(s.id, 'reps')}
            >
              {s.reps || <span className="xb-ph">reps</span>}
            </button>
            <div className="xb-rpe">{s.rpe}</div>
            <button
              type="button"
              className={`xb-check ${s.done ? 'is-done' : ''}`}
              onClick={() => onToggleDone(s.id)}
              aria-label="Mark complete"
            >
              {s.done && (
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M2 5.5l2.5 2.5 4.5-4.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            {e1rm > 0 && <div className="xb-row-e1rm">e1RM {e1rm.toFixed(1)}kg</div>}
          </div>
        );
        if (!isExtraSet) return <div key={s.id}>{rowInner}</div>;
        return (
          <Swipeable
            key={s.id}
            onDelete={() => onDeleteSet(s.id)}
            trackClassName="xb-row-swipe"
          >
            {rowInner}
          </Swipeable>
        );
      })}

      <button type="button" className="xb-add" onClick={onAddSet}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Add Set
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

interface ActiveWorkoutProps {
  onFinish: () => void;
}

export function ActiveWorkout({ onFinish }: ActiveWorkoutProps) {
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
  // or session change). We use a fingerprint of the exercise ids — not just the
  // length — so a delete-then-add of equal count still triggers a rebuild.
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

  const handleFocus = (exId: number, setId: string, field: 'weight' | 'reps') => {
    setActive({ exId, setId, field });
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
  };

  const handleAddSet = (exId: number) => {
    // Persist first so the SetLog gets a real id from the store.
    addSetToStore(exId);
    // Mirror in local UI state — the resync effect only fires when the outer
    // exercises list grows, not when an inner sets array grows, so we have to
    // append here too or the new row won't render.
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
    // If the deleted set was the active focus, clear it.
    setActive((cur) =>
      cur && cur.exId === exId && cur.setId === setId ? null : cur,
    );
  };

  const handleDeleteExercise = (exId: number) => {
    removeExerciseFromStore(exId);
    // No need to mirror locally — the resync effect detects the fingerprint
    // change and rebuilds local state from the authoritative store.
    setActive((cur) => (cur && cur.exId === exId ? null : cur));
  };

  const handleApplyTarget = (exId: number, setId: string) => {
    const ex = exercises.find((e) => e.exId === exId);
    if (!ex) return;
    const weight = ex.prevTop ? String(ex.prevTop.weight) : '';
    const reps = ex.prescription?.reps ?? (ex.prevTop ? String(ex.prevTop.reps) : '');
    const repsParsed = parseInt(reps, 10);
    const rpe = ex.prescription?.rpeTarget ?? ex.prevTop?.rpe ?? 7;
    updateSetLocal(exId, setId, { weight, reps, rpe });
    const setIndex = setIndexFromId(setId);
    const patch: Partial<SetLog> = { rpe };
    if (ex.prevTop) patch.weight = ex.prevTop.weight;
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
            if (key === 'back') next = cur.slice(0, -1);
            else if (key === '.') {
              if (cur.includes('.')) return s;
              next = cur + '.';
            } else next = cur + key;
            nextValue = next;
            return { ...s, [field]: next };
          }),
        };
      }),
    );
    const setIndex = setIndexFromId(setId);
    const numeric = field === 'weight' ? parseFloat(nextValue) : parseInt(nextValue, 10);
    if (Number.isFinite(numeric)) {
      updateSetInStore(exId, setIndex, { [field]: numeric });
    } else if (nextValue === '') {
      updateSetInStore(exId, setIndex, { [field]: 0 });
    }
  };

  const handleNext = () => {
    if (!active) return;
    const all = getAllInputs();
    const idx = all.findIndex(
      (i) => i.exId === active.exId && i.setId === active.setId && i.field === active.field,
    );
    if (idx >= 0 && idx < all.length - 1) setActive(all[idx + 1]);
    else setActive(null);
  };

  const handleRPE = (rpe: number) => {
    if (!active) return;
    updateSetLocal(active.exId, active.setId, { rpe });
    const setIndex = setIndexFromId(active.setId);
    updateSetInStore(active.exId, setIndex, { rpe });
  };

  const handleAddExercises = (newExercises: TrainingExercise[]) => {
    if (!activeSession) return;
    // Just persist to the store — the resync useEffect detects the length
    // change and rebuilds local UI state from the authoritative store data.
    // This guarantees each new exercise's local exId equals its real store
    // index (positional), which all later mutations (updateSet, removeSet,
    // addSetToExercise, removeExercise) require.
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
    >
      <div className="as-topbar">
        {/* <button type="button" className="as-cancel" onClick={onFinish} aria-label="Collapse">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button> */}
        <div className="as-timer">
          <span className="as-timer-dot" />
          <span className="as-timer-val">{formattedTime}</span>
        </div>
        <button type="button" className="as-finish" onClick={onFinish}>
          Finish
        </button>
      </div>

      <div className="as-head">
        <div className="as-head-eyebrow">
          <span>Session in progress</span>
          <span className="as-head-dot">·</span>
          <span>
            {doneSets}/{totalSets} sets logged
          </span>
        </div>
        <h1 className="as-head-title">{cleanName}</h1>
        <div className="as-head-bar">
          <div
            className="as-head-bar-fill"
            style={{ width: `${(doneSets / Math.max(totalSets, 1)) * 100}%` }}
          />
        </div>
      </div>

      <div className="as-stack" style={{ paddingBottom: active ? 360 : 80 }}>
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
            />
          );
          // Whole exercise is deletable when it has no prescription
          // (added mid-session via Add Exercise, or part of an empty workout).
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

      {createPortal(
        <Numpad
          visible={active !== null}
          active={active}
          exercises={exercises}
          onKey={handleNumpadKey}
          onHide={() => setActive(null)}
          onNext={handleNext}
          onRPE={handleRPE}
        />,
        document.body,
      )}
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
