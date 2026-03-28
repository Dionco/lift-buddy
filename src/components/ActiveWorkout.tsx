import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTrainingStore } from "@/store/useTrainingStore";
import { useElapsedTime } from "@/hooks/useElapsedTime";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkoutSet {
  id: string;
  weight: string;
  reps: string;
  prev: string;
  done: boolean;
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

// ─── Sample data ─────────────────────────────────────────────────────────────

const INITIAL_EXERCISES: Exercise[] = [
  {
    id: 1,
    name: "Squat (Paused)",
    sets: [
      { id: "1-1", weight: "100", reps: "5", prev: "100 kg × 5", done: false },
      { id: "1-2", weight: "100", reps: "5", prev: "100 kg × 5", done: false },
      { id: "1-3", weight: "100", reps: "6", prev: "100 kg × 6", done: false },
    ],
  },
  {
    id: 2,
    name: "Lateral Raise (Dumbbell)",
    sets: [
      { id: "2-1", weight: "7", reps: "11", prev: "7 kg × 11", done: false },
      { id: "2-2", weight: "7", reps: "12", prev: "7 kg × 12", done: false },
      { id: "2-3", weight: "7", reps: "11", prev: "7 kg × 11", done: false },
    ],
  },
];

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
}

function SetInput({ value, placeholder, isActive, onClick }: SetInputProps) {
  return (
    <div
      data-set-input
      onClick={onClick}
      style={{
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
    </div>
  );
}

interface ExerciseCardProps {
  exercise: Exercise;
  activeInput: ActiveInput | null;
  onInputFocus: (exId: number, setId: string, field: "weight" | "reps") => void;
  onToggleDone: (exId: number, setId: string) => void;
  onAddSet: (exId: number) => void;
}

function ExerciseCard({ exercise, activeInput, onInputFocus, onToggleDone, onAddSet }: ExerciseCardProps) {
  return (
    <div
      // ExerciseCard root div — add flexShrink: 0
      style={{
        background: "#FFFFFF",
        border: "0.5px solid #D3D1C7",
        borderRadius: 12,
        overflow: "hidden",
        flexShrink: 0,   // ← ADD THIS
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
          gridTemplateColumns: "28px 1fr 60px 60px 28px",
          gap: 6,
          padding: "6px 14px",
          alignItems: "center",
        }}
      >
        {(["Set", "Previous", "kg", "Reps", ""] as const).map((label, i) => (
          <span
            key={i}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#888780",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              textAlign: i === 0 || i === 4 ? "left" : "center",
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
              gridTemplateColumns: "28px 1fr 60px 60px 28px",
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
            <span
              style={{
                fontSize: 13,
                color: "#888780",
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              {set.id.split("-")[1]}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#888780",
                textAlign: "center",
              }}
            >
              {set.prev}
            </span>
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

interface NumpadProps {
  visible: boolean;
  onKey: (val: string) => void;
  onHide: () => void;
  onRPE: () => void;
  onNext: () => void;
}

function Numpad({ visible, onKey, onHide, onRPE, onNext }: NumpadProps) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"] as const;

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
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          borderBottom: "0.5px solid #D3D1C7",
        }}
      >
        <button
          onClick={onHide}
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
          onClick={onRPE}
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
        }}
      >
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
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ActiveWorkoutProps {
  onFinish: () => void;
}

export function ActiveWorkout({ onFinish }: ActiveWorkoutProps) {
  const activeSession = useTrainingStore((s) => s.activeSession);
  const [exercises, setExercises] = useState<Exercise[]>(INITIAL_EXERCISES);
  const [activeInput, setActiveInput] = useState<ActiveInput | null>(null);

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

  const handleToggleDone = (exId: number, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id !== exId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id === setId ? { ...s, done: !s.done } : s
              ),
            }
      )
    );
  };

  const handleAddSet = (exId: number) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const newSet: WorkoutSet = {
          id: `${exId}-${ex.sets.length + 1}`,
          weight: last?.weight ?? "",
          reps: "",
          prev: last ? `${last.weight} kg × ${last.reps}` : "–",
          done: false,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      })
    );
  };

  // Numpad handlers
  const handleNumpadKey = (val: string) => {
    if (!activeInput) return;
    const { exId, setId, field } = activeInput;

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
            return { ...s, [field]: next };
          }),
        };
      })
    );
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

  const handleRPE = () => {
    // Hook into your RPE flow here
    console.log("RPE tapped for", activeInput);
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
    </div>
  );
}