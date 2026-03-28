// src/components/AddExerciseSheet.tsx
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { EXERCISES } from "@/data/sampleProgram";
import { Exercise, MuscleGroup, Session } from "@/types/training";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function computeUsageCounts(sessions: Session[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    for (const log of session.exercises) {
      const id = log.exercise.id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const ALL_EXERCISES = Object.values(EXERCISES);

const MUSCLE_GROUPS: MuscleGroup[] = Array.from(
  new Set(ALL_EXERCISES.map((e) => e.muscleGroup))
).sort() as MuscleGroup[];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddExerciseSheetProps {
  visible: boolean;
  sessions: Session[];
  onClose: () => void;
  onAdd: (exercises: Exercise[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddExerciseSheet({ visible, sessions, onClose, onAdd }: AddExerciseSheetProps) {
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset state each time sheet opens
  useEffect(() => {
    if (visible) {
      setQuery("");
      setMuscleFilter(null);
      setSelected(new Set());
    }
  }, [visible]);

  const usageCounts = useMemo(() => computeUsageCounts(sessions), [sessions]);

  const filteredExercises = useMemo(() => {
    const q = query.toLowerCase();
    return ALL_EXERCISES
      .filter((ex) => {
        const matchesQuery = ex.name.toLowerCase().includes(q);
        const matchesMuscle = muscleFilter === null || ex.muscleGroup === muscleFilter;
        return matchesQuery && matchesMuscle;
      })
      .sort((a, b) => (usageCounts[b.id] ?? 0) - (usageCounts[a.id] ?? 0));
  }, [query, muscleFilter, usageCounts]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    onAdd(ALL_EXERCISES.filter((ex) => selected.has(ex.id)));
  };

  const addLabel = selected.size > 0 ? `Add Exercises (${selected.size})` : "Add Exercises";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        data-testid="exercise-sheet-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 79,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition: "opacity 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "85vh",
          background: "#FFFFFF",
          borderRadius: "16px 16px 0 0",
          zIndex: 80,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 16px 12px",
            borderBottom: "0.5px solid #D3D1C7",
            flexShrink: 0,
          }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#888780",
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
              width: 28,
            }}
          >
            ×
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#2C2C2A" }}>Exercises</span>
          <div style={{ width: 28 }} />
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#F1EFE8",
              border: "0.5px solid #D3D1C7",
              borderRadius: 10,
              padding: "9px 12px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="#888780" strokeWidth="1.5" />
              <path d="M9.5 9.5l2.5 2.5" stroke="#888780" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercise name"
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                fontSize: 14,
                color: "#2C2C2A",
              }}
            />
          </div>
        </div>

        {/* Muscle group filter pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 16px",
            overflowX: "auto",
            flexShrink: 0,
            scrollbarWidth: "none",
          }}
        >
          <button
            onClick={() => setMuscleFilter(null)}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              borderRadius: 20,
              border: "0.5px solid #D3D1C7",
              background: muscleFilter === null ? "#7F77DD" : "#F1EFE8",
              color: muscleFilter === null ? "white" : "#5F5E5A",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((mg) => (
            <button
              key={mg}
              onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
              style={{
                flexShrink: 0,
                padding: "5px 12px",
                borderRadius: 20,
                border: "0.5px solid #D3D1C7",
                background: muscleFilter === mg ? "#7F77DD" : "#F1EFE8",
                color: muscleFilter === mg ? "white" : "#5F5E5A",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {mg}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#888780",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "8px 0 4px",
            }}
          >
            {query || muscleFilter ? "Results" : "Recent Exercises"}
          </div>

          {filteredExercises.map((ex) => {
            const isSelected = selected.has(ex.id);
            const count = usageCounts[ex.id] ?? 0;
            return (
              <div
                key={ex.id}
                onClick={() => toggleSelect(ex.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 8px",
                  borderBottom: "0.5px solid #F1EFE8",
                  background: isSelected ? "#F3F2FD" : "transparent",
                  cursor: "pointer",
                  borderRadius: 8,
                  transition: "background 0.15s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 1 }}>
                    {ex.muscleGroup}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#888780", flexShrink: 0, marginRight: 8 }}>
                  {count > 0 ? `${count} ${count === 1 ? "time" : "times"}` : "—"}
                </div>
                {/* Inline checkbox — matches SetCheckbox visual style */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: isSelected ? "1.5px solid #7F77DD" : "1.5px solid #B4B2A9",
                    background: isSelected ? "#7F77DD" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M2 5.5l2.5 2.5 4.5-4.5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}

          {filteredExercises.length === 0 && (
            <div
              style={{
                padding: "24px 0",
                textAlign: "center",
                fontSize: 14,
                color: "#888780",
              }}
            >
              No exercises found
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: "0.5px solid #D3D1C7",
            padding: "12px 16px",
            background: "#FFFFFF",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            disabled
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 12,
              border: "0.5px solid #D3D1C7",
              background: "transparent",
              fontSize: 14,
              fontWeight: 500,
              color: "#B4B2A9",
              cursor: "not-allowed",
            }}
          >
            Add as Superset
          </button>
          <button
            onClick={selected.size > 0 ? handleAdd : undefined}
            disabled={selected.size === 0}
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 12,
              border: "none",
              background: selected.size > 0 ? "#7F77DD" : "#D3D1C7",
              fontSize: 14,
              fontWeight: 500,
              color: "white",
              cursor: selected.size > 0 ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            {addLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
