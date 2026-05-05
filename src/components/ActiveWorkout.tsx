import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTrainingStore } from "@/store/useTrainingStore";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import { Exercise as TrainingExercise, ExerciseLog, SetLog } from "@/types/training";
import { AddExerciseSheet } from "./AddExerciseSheet";

let _exerciseIdCounter = Date.now();
const nextExerciseId = () => ++_exerciseIdCounter;

/**
 * Convert a store ExerciseLog (positional in activeSession.exercises) into the
 * UI's local Exercise shape. `exId` is the array index — that's our stable handle
 * back into the store for `updateSet` / `addSetToExercise` / etc.
 *
 * Per ADR-0006: the UI shows actual logged values. Reps starts blank, never
 * defaulted from prescription. Weight starts blank too unless previously typed.
 */
function exerciseLogToLocal(log: ExerciseLog, exId: number): Exercise {
  return {
    id: exId,
    name: log.exercise.name,
    sets: log.sets.map((s, i) => ({
      id: `${exId}-${i + 1}`,
      weight: s.weight > 0 ? String(s.weight) : "",
      reps: s.reps > 0 ? String(s.reps) : "",
      prev: "—",
      done: s.completed,
      rpe: s.rpe,
      programRPE: undefined,
      target: undefined,
    })),
  };
}

function buildInitialExercises(activeSessionExercises: ExerciseLog[] | undefined): Exercise[] {
  if (!activeSessionExercises || activeSessionExercises.length === 0) return [];
  return activeSessionExercises.map(exerciseLogToLocal);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkoutSet {
  id: string;
  weight: string;
  reps: string;
  prev: string;
  done: boolean;
  rpe?: number;
  /** RPE target prescribed by the program */
  programRPE?: number;
  /** Target weight × reps prescribed by the program, e.g. "100 × 5" */
  target?: string;
}

interface Exercise {
  id: number;
  name: string;
  sets: WorkoutSet[];
}

interface ActiveInput {
  exId: number;
  setId: string;
  field: "weight" | "reps";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
}

function SetCheckbox({ checked, onToggle }: CheckboxProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: checked ? "1.5px solid #7F77DD" : "1.5px solid #B4B2A9",
        background: checked ? "#7F77DD" : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        margin: "0 auto",
        transition: "all 0.15s",
        padding: 0,
      }}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

interface SetInputProps {
  value: string;
  placeholder: string;
  isActive: boolean;
  onClick: () => void;
  rpe?: number;
}

function SetInput({ value, placeholder, isActive, onClick, rpe }: SetInputProps) {
  return (
    <div
      data-set-input
      onClick={onClick}
      style={{
        position: "relative",
        background: isActive ? "#EEEDFE" : "#F1EFE8",
        border: `0.5px solid ${isActive ? "#7F77DD" : "#D3D1C7"}`,
        borderRadius: 6,
        padding: "6px 0",
        fontSize: 14,
        fontWeight: 500,
        color: isActive ? "#3C3489" : value ? "#2C2C2A" : "#888780",
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        width: "100%",
        userSelect: "none",
      }}
    >
      {value || placeholder}
      {rpe !== undefined && (
        <span
          style={{
            position: "absolute",
            top: -5,
            right: -5,
            background: "#7F77DD",
            color: "white",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            padding: "2px 3px",
            borderRadius: 4,
            letterSpacing: "0.01em",
            pointerEvents: "none",
          }}
        >
          {rpe % 1 === 0 ? rpe : rpe}
        </span>
      )}
    </div>
  );
}

interface ExerciseCardProps {
  exercise: Exercise;
  activeInput: ActiveInput | null;
  onInputFocus: (exId: number, setId: string, field: "weight" | "reps") => void;
  onToggleDone: (exId: number, setId: string) => void;
  onAddSet: (exId: number) => void;
  isFromProgram: boolean;
}

function ExerciseCard({ exercise, activeInput, onInputFocus, onToggleDone, onAddSet, isFromProgram }: ExerciseCardProps) {
  const [col2Mode, setCol2Mode] = useState<"rpe" | "prev">("rpe");

  // Program layout: Set | RPE/Prev | Target | kg | Reps | ✓
  // Free layout:    Set | Previous | kg | Reps | ✓
  const grid = isFromProgram
    ? "24px 1fr 1fr 56px 56px 28px"
    : "28px 1fr 60px 60px 28px";

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "0.5px solid #D3D1C7",
        borderRadius: 12,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px 10px",
          borderBottom: "0.5px solid #D3D1C7",
        }}
      >
        <button
          style={{
            background: "none",
            border: "none",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 14,
            fontWeight: 600,
            color: "#7F77DD",
            cursor: "pointer",
          }}
        >
          {exercise.name}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3l3 3-3 3" stroke="#7F77DD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#888780",
            fontSize: 18,
            letterSpacing: 2,
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ···
        </button>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: grid,
          gap: 6,
          padding: "6px 14px",
          alignItems: "center",
        }}
      >
        {/* Set */}
        <span style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Set
        </span>

        {isFromProgram ? (
          <>
            {/* Col 2: RPE/Prev toggle */}
            <button
              onClick={() => setCol2Mode((m) => (m === "rpe" ? "prev" : "rpe"))}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 500, color: "#7F77DD", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {col2Mode === "rpe" ? "RPE" : "Prev"}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 3.5h8M1 6.5h8M3 1.5L1 3.5l2 2M7 4.5l2 2-2 2" stroke="#7F77DD" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* Col 3: Target */}
            <span style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center" }}>
              Target
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center" }}>
            Previous
          </span>
        )}

        {/* kg, Reps, empty */}
        {(["kg", "Reps", ""] as const).map((label, i) => (
          <span
            key={label + i}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#888780",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              textAlign: "center",
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Set rows */}
      {exercise.sets.map((set) => {
        const isWeightActive =
          activeInput?.exId === exercise.id &&
          activeInput.setId === set.id &&
          activeInput.field === "weight";
        const isRepsActive =
          activeInput?.exId === exercise.id &&
          activeInput.setId === set.id &&
          activeInput.field === "reps";
        const rowActive = isWeightActive || isRepsActive;

        return (
          <div
            key={set.id}
            style={{
              display: "grid",
              gridTemplateColumns: grid,
              gap: 6,
              padding: "5px 14px",
              alignItems: "center",
              background: rowActive ? "#F3F2FD" : "transparent",
              borderRadius: 6,
              margin: "0 4px",
              opacity: set.done ? 0.5 : 1,
              transition: "opacity 0.15s, background 0.15s",
            }}
          >
            {/* Set number */}
            <span style={{ fontSize: 13, color: "#888780", fontWeight: 500, textAlign: "center" }}>
              {set.id.split("-")[1]}
            </span>

            {isFromProgram ? (
              <>
                {/* Col 2: RPE target or Previous */}
                <span style={{ fontSize: 12, color: "#888780", textAlign: "center" }}>
                  {col2Mode === "rpe"
                    ? set.programRPE !== undefined
                      ? <span style={{ fontWeight: 600, color: "#7F77DD" }}>@{set.programRPE}</span>
                      : "—"
                    : set.prev || "—"}
                </span>
                {/* Col 3: Target */}
                <span style={{ fontSize: 12, color: "#5F5E5A", fontWeight: 500, textAlign: "center" }}>
                  {set.target ?? "—"}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "#888780", textAlign: "center" }}>
                {set.prev}
              </span>
            )}

            <SetInput
              value={set.weight}
              placeholder="kg"
              isActive={isWeightActive}
              onClick={() => onInputFocus(exercise.id, set.id, "weight")}
            />
            <SetInput
              value={set.reps}
              placeholder="reps"
              isActive={isRepsActive}
              onClick={() => onInputFocus(exercise.id, set.id, "reps")}
              rpe={set.rpe}
            />
            <SetCheckbox
              checked={set.done}
              onToggle={() => onToggleDone(exercise.id, set.id)}
            />
          </div>
        );
      })}

      {/* Add set */}
      <button
        onClick={() => onAddSet(exercise.id)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "calc(100% - 28px)",
          margin: "8px 14px 12px",
          padding: 8,
          background: "#F1EFE8",
          border: "0.5px dashed #B4B2A9",
          borderRadius: 8,
          fontSize: 13,
          color: "#5F5E5A",
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Add Set
      </button>
    </div>
  );
}

// ─── Number Pad ───────────────────────────────────────────────────────────────

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;
const RPE_LABELS: Record<number, string> = {
  6: "Moderate", 6.5: "Moderate", 7: "Vigorous",
  7.5: "Vigorous", 8: "Hard", 8.5: "Hard",
  9: "Very Hard", 9.5: "Very Hard", 10: "Max Effort",
};

interface NumpadProps {
  visible: boolean;
  onKey: (val: string) => void;
  onHide: () => void;
  onRPE: (rpe: number) => void;
  onNext: () => void;
}

function Numpad({ visible, onKey, onHide, onRPE, onNext }: NumpadProps) {
  const [showRPE, setShowRPE] = useState(false);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"] as const;

  // Reset to numpad when the pad is hidden
  const handleHide = () => {
    setShowRPE(false);
    onHide();
  };

  const handleSelectRPE = (rpe: number) => {
    onRPE(rpe);
    setShowRPE(false);
  };

  return (
    <div
      data-numpad
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#FFFFFF",
        borderTop: "0.5px solid #B4B2A9",
        borderRadius: "16px 16px 0 0",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 70,
        overflow: "hidden",
      }}
    >
      {/* Sliding panels container */}
      <div
        style={{
          display: "flex",
          width: "200%",
          transform: showRPE ? "translateX(-50%)" : "translateX(0)",
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* ── Panel 1: Number pad ── */}
        <div style={{ width: "50%", flexShrink: 0 }}>
          {/* Toolbar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              borderBottom: "0.5px solid #D3D1C7",
            }}
          >
            <button
              onClick={handleHide}
              style={{
                background: "none",
                border: "none",
                borderRight: "0.5px solid #D3D1C7",
                padding: "12px 8px",
                fontSize: 13,
                fontWeight: 500,
                color: "#5F5E5A",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 7.5h6M5 9.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Hide
            </button>
            <button
              onClick={() => setShowRPE(true)}
              style={{
                background: "none",
                border: "none",
                borderRight: "0.5px solid #D3D1C7",
                padding: "12px 8px",
                fontSize: 13,
                fontWeight: 500,
                color: "#5F5E5A",
                cursor: "pointer",
              }}
            >
              RPE
            </button>
            <button
              onClick={onNext}
              style={{
                background: "none",
                border: "none",
                padding: "12px 8px",
                fontSize: 13,
                fontWeight: 600,
                color: "#7F77DD",
                cursor: "pointer",
              }}
            >
              Next →
            </button>
          </div>

          {/* Keys */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
            {keys.map((key, i) => (
              <button
                key={key}
                onClick={() => onKey(key)}
                style={{
                  background: "none",
                  border: "none",
                  borderTop: "0.5px solid #D3D1C7",
                  borderRight: (i + 1) % 3 !== 0 ? "0.5px solid #D3D1C7" : "none",
                  padding: "14px 8px",
                  fontSize: key === "backspace" ? 16 : 20,
                  fontWeight: 400,
                  color: key === "backspace" || key === "." ? "#888780" : "#2C2C2A",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "background 0.1s",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {key === "backspace" ? "⌫" : key === "." ? "·" : key}
              </button>
            ))}
          </div>
        </div>

        {/* ── Panel 2: RPE pad ── */}
        <div style={{ width: "50%", flexShrink: 0 }}>
          {/* RPE toolbar */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderBottom: "0.5px solid #D3D1C7",
            }}
          >
            <button
              style={{
                background: "none",
                border: "none",
                borderRight: "0.5px solid #D3D1C7",
                padding: "12px 8px",
                fontSize: 13,
                fontWeight: 500,
                color: "#888780",
                cursor: "default",
                textAlign: "center",
              }}
            >
              ?
            </button>
            <button
              onClick={() => setShowRPE(false)}
              style={{
                background: "none",
                border: "none",
                padding: "12px 8px",
                fontSize: 13,
                fontWeight: 600,
                color: "#7F77DD",
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          </div>

          {/* Description */}
          <div
            style={{
              padding: "8px 14px",
              fontSize: 12,
              color: "#888780",
              borderBottom: "0.5px solid #D3D1C7",
              lineHeight: 1.4,
            }}
          >
            RPE is a way to measure the difficulty of a set. Tap a number to select an RPE value.
          </div>

          {/* RPE grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
            {RPE_VALUES.map((rpe, i) => (
              <button
                key={rpe}
                onClick={() => handleSelectRPE(rpe)}
                style={{
                  background: "none",
                  border: "none",
                  borderTop: "0.5px solid #D3D1C7",
                  borderRight: (i + 1) % 3 !== 0 ? "0.5px solid #D3D1C7" : "none",
                  padding: "12px 8px",
                  cursor: "pointer",
                  textAlign: "center",
                  WebkitTapHighlightColor: "transparent",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 500, color: "#2C2C2A" }}>
                  {rpe % 1 === 0 ? rpe : rpe}
                </span>
                <span style={{ fontSize: 10, color: "#888780", fontWeight: 400 }}>
                  {RPE_LABELS[rpe]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ActiveWorkoutProps {
  onFinish: () => void;
}

export function ActiveWorkout({ onFinish }: ActiveWorkoutProps) {
  const activeSession = useTrainingStore((s) => s.activeSession);
  const sessions = useTrainingStore((s) => s.sessions);
  const addExerciseToStore = useTrainingStore((s) => s.addExercise);
  const updateSetInStore = useTrainingStore((s) => s.updateSet);
  const addSetToStore = useTrainingStore((s) => s.addSetToExercise);
  const isFromProgram = !!activeSession?.programDayId;
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    buildInitialExercises(activeSession?.exercises)
  );
  const [activeInput, setActiveInput] = useState<ActiveInput | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);

  // Re-sync local state when the store's exercise list grows (via addExercise from
  // AddExerciseSheet) or when a new session starts. We track length to avoid
  // clobbering the user's in-progress typed input on every store update.
  const sessionIdRef = useRef(activeSession?.id);
  const lastExerciseCountRef = useRef(activeSession?.exercises.length ?? 0);
  useEffect(() => {
    if (!activeSession) return;
    const sessionChanged = sessionIdRef.current !== activeSession.id;
    const exerciseCountChanged =
      lastExerciseCountRef.current !== activeSession.exercises.length;
    if (sessionChanged || exerciseCountChanged) {
      setExercises(buildInitialExercises(activeSession.exercises));
      sessionIdRef.current = activeSession.id;
      lastExerciseCountRef.current = activeSession.exercises.length;
    }
  }, [activeSession]);

  const formattedTime = useElapsedTime(activeSession?.startTime ?? Date.now());

  // Input helpers
  const getAllInputs = useCallback((): ActiveInput[] => {
    const inputs: ActiveInput[] = [];
    exercises.forEach((ex) => {
      ex.sets.forEach((set) => {
        inputs.push({ exId: ex.id, setId: set.id, field: "weight" });
        inputs.push({ exId: ex.id, setId: set.id, field: "reps" });
      });
    });
    return inputs;
  }, [exercises]);

  const handleInputFocus = (exId: number, setId: string, field: "weight" | "reps") => {
    setActiveInput({ exId, setId, field });
  };

  // Parse the local setId back into the store's set index (it's 1-based in the local id).
  const setIndexFromId = (setId: string): number => {
    const parts = setId.split("-");
    const n = parseInt(parts[1] ?? "1", 10);
    return Number.isFinite(n) ? n - 1 : 0;
  };

  const handleToggleDone = (exId: number, setId: string) => {
    let nextDone = false;
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) => {
                if (s.id !== setId) return s;
                nextDone = !s.done;
                return { ...s, done: nextDone };
              }),
            }
      )
    );
    // Also persist the chosen weight/reps/rpe so the store reflects what the lifter logged.
    const ex = exercises.find((e) => e.id === exId);
    const set = ex?.sets.find((s) => s.id === setId);
    const setIndex = setIndexFromId(setId);
    const updates: Partial<SetLog> = { completed: nextDone };
    if (set) {
      const weight = parseFloat(set.weight);
      const reps = parseInt(set.reps, 10);
      if (Number.isFinite(weight)) updates.weight = weight;
      if (Number.isFinite(reps)) updates.reps = reps;
      if (set.rpe !== undefined) updates.rpe = set.rpe;
      updates.timestamp = Date.now();
    }
    updateSetInStore(exId, setIndex, updates);
  };

  const handleAddSet = (exId: number) => {
    // Persist the new set first; the store's addSetToExercise mirrors the previous set's
    // values so the user sees the same starting state. The useEffect above re-syncs local state.
    addSetToStore(exId);
  };

  // Numpad handlers
  const handleNumpadKey = (val: string) => {
    if (!activeInput) return;
    const { exId, setId, field } = activeInput;
    let nextValue = "";

    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            const current = s[field];
            let next: string;
            if (val === "backspace") {
              next = current.slice(0, -1);
            } else if (val === "." && current.includes(".")) {
              return s;
            } else {
              next = current + val;
            }
            nextValue = next;
            return { ...s, [field]: next };
          }),
        };
      })
    );

    // Persist the parsed value to the store so the Session reflects actual input.
    const setIndex = setIndexFromId(setId);
    const numeric = field === "weight" ? parseFloat(nextValue) : parseInt(nextValue, 10);
    if (Number.isFinite(numeric)) {
      updateSetInStore(exId, setIndex, { [field]: numeric });
    } else if (nextValue === "") {
      // Cleared input — reset to 0 in storage so it can't masquerade as logged data.
      updateSetInStore(exId, setIndex, { [field]: 0 });
    }
  };

  const handleHide = () => setActiveInput(null);

  const handleNext = () => {
    if (!activeInput) return;
    const all = getAllInputs();
    const idx = all.findIndex(
      (i) =>
        i.exId === activeInput.exId &&
        i.setId === activeInput.setId &&
        i.field === activeInput.field
    );
    if (idx < all.length - 1) {
      const next = all[idx + 1];
      setActiveInput(next);
    } else {
      setActiveInput(null);
    }
  };

  const handleRPE = (rpe: number) => {
    if (!activeInput) return;
    const { exId, setId } = activeInput;
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, rpe } : s)) }
      )
    );
    const setIndex = setIndexFromId(setId);
    updateSetInStore(exId, setIndex, { rpe });
  };

  const handleAddExercises = (newExercises: TrainingExercise[]) => {
    if (!activeSession) return;
    newExercises.forEach((ex) => {
      addExerciseToStore({ exercise: ex, sets: [] });
    });
    setExercises((prev) => [
      ...prev,
      ...newExercises.map((ex) => ({
        id: nextExerciseId(),
        name: ex.name,
        sets: [],
      })),
    ]);
    setShowAddExercise(false);
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "#F1EFE8",
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-numpad]") && !target.closest("[data-set-input]")) {
          setActiveInput(null);
        }
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 12px",
          background: "#FFFFFF",
          borderBottom: "0.5px solid #D3D1C7",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            border: "0.5px solid #B4B2A9",
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 500,
            color: "#2C2C2A",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" />
            <rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor" />
          </svg>
          {formattedTime}
        </div>
        <button
          style={{
            background: "#7F77DD",
            color: "white",
            border: "none",
            borderRadius: 20,
            padding: "8px 22px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
          onClick={onFinish}
        >
          Finish
        </button>
      </div>

      {/* Workout title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 0",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A" }}>
          {activeSession?.workoutName ?? "Workout"}
        </span>
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#888780",
            padding: 4,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" />
          </svg>
        </button>
      </div>

      {/* Scrollable exercise list */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          paddingTop: 12,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: activeInput !== null ? 280 : 24,
          transition: "padding-bottom 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            activeInput={activeInput}
            onInputFocus={handleInputFocus}
            onToggleDone={handleToggleDone}
            onAddSet={handleAddSet}
            isFromProgram={isFromProgram}
          />
        ))}

        <button
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: 13,
            background: "#7F77DD",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 500,
            color: "white",
            cursor: "pointer",
            flexShrink: 0,   // ← ADD THIS
          }}
          onClick={() => setShowAddExercise(true)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Add Exercise
        </button>
      </div>

      {/* Number pad — rendered at document.body via portal so it is truly
           viewport-fixed and unaffected by WorkoutSheet's transform/clip-path */}
      {createPortal(
        <Numpad
          visible={activeInput !== null}
          onKey={handleNumpadKey}
          onHide={handleHide}
          onRPE={handleRPE}
          onNext={handleNext}
        />,
        document.body,
      )}
      <AddExerciseSheet
        visible={showAddExercise}
        sessions={sessions}
        onClose={() => setShowAddExercise(false)}
        onAdd={handleAddExercises}
      />
    </div>
  );
}