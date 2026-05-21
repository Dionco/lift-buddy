// src/components/AddExerciseSheet.tsx
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { EXERCISES } from "@/data/sampleProgram";
import { Exercise, MuscleGroup, MuscleRegion, MUSCLE_REGION, MUSCLE_REGION_ORDER, Session } from "@/types/training";
import { formatMuscles } from "@/lib/muscleLabels";

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

// Muscle groups represented in the catalogue, sectioned by region for the
// horizontally-scrollable filter chip rail.
const MUSCLE_GROUPS_BY_REGION: ReadonlyArray<{ region: MuscleRegion; muscles: MuscleGroup[] }> =
  (() => {
    const present = new Set<MuscleGroup>();
    for (const ex of ALL_EXERCISES) {
      for (const m of ex.primaryMuscles) present.add(m);
    }
    return MUSCLE_REGION_ORDER.map((region) => ({
      region,
      muscles: Array.from(present)
        .filter((m) => MUSCLE_REGION[m] === region)
        .sort(),
    })).filter((section) => section.muscles.length > 0);
  })();

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddExerciseSheetProps {
  visible: boolean;
  sessions: Session[];
  /** Exercise ids already present in the active workout — hidden from the catalogue. */
  existingIds?: readonly string[];
  onClose: () => void;
  onAdd: (exercises: Exercise[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddExerciseSheet({ visible, sessions, existingIds, onClose, onAdd }: AddExerciseSheetProps) {
  const existingSet = useMemo(() => new Set(existingIds ?? []), [existingIds]);
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
        if (existingSet.has(ex.id)) return false;
        const matchesQuery = ex.name.toLowerCase().includes(q);
        const matchesMuscle = muscleFilter === null || ex.primaryMuscles.includes(muscleFilter);
        return matchesQuery && matchesMuscle;
      })
      .sort((a, b) => (usageCounts[b.id] ?? 0) - (usageCounts[a.id] ?? 0));
  }, [query, muscleFilter, usageCounts, existingSet]);

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

  const sectionLabel = query || muscleFilter ? "Results" : "Recent Exercises";

  return createPortal(
    <>
      <div
        data-testid="exercise-sheet-backdrop"
        onClick={onClose}
        className="aes-backdrop"
        style={{
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
      />

      <div
        className="aes-sheet"
        style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
        role="dialog"
        aria-label="Exercises"
      >
        <div className="aes-grab" aria-hidden />

        <div className="aes-head">
          <div className="aes-head-title">
            <div className="aes-eyebrow">Catalogue</div>
            <h2 className="aes-title">Exercises</h2>
          </div>
          <button type="button" aria-label="Close" className="aes-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="aes-search-wrap">
          <div className="aes-search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="var(--muted)" strokeWidth="1.4" />
              <path d="M9.5 9.5l2.5 2.5" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercise name"
            />
          </div>
        </div>

        <div className="aes-pills" role="tablist">
          <button
            type="button"
            className={`aes-pill ${muscleFilter === null ? "is-active" : ""}`}
            onClick={() => setMuscleFilter(null)}
          >
            All
          </button>
          {MUSCLE_GROUPS_BY_REGION.map((section, sIdx) => (
            <span key={section.region} className="aes-pill-group">
              {sIdx > 0 && <span className="aes-pill-divider" aria-hidden />}
              <span className="aes-pill-region">{section.region}</span>
              {section.muscles.map((mg) => (
                <button
                  key={mg}
                  type="button"
                  className={`aes-pill ${muscleFilter === mg ? "is-active" : ""}`}
                  onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
                >
                  {mg}
                </button>
              ))}
            </span>
          ))}
        </div>

        <div className="aes-list">
          <div className="aes-section-rule">
            <span>{sectionLabel}</span>
            <div className="aes-section-line" />
          </div>

          {filteredExercises.map((ex, i) => {
            const isSelected = selected.has(ex.id);
            const count = usageCounts[ex.id] ?? 0;
            return (
              <button
                type="button"
                key={ex.id}
                onClick={() => toggleSelect(ex.id)}
                className={`aes-row ${isSelected ? "is-selected" : ""}`}
                aria-pressed={isSelected}
              >
                <span className="aes-row-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="aes-row-body">
                  <span className="aes-row-name">
                    {ex.name}
                    {ex.isMainLift && <span className="aes-row-main" title="Main Lift">●</span>}
                  </span>
                  <span className="aes-row-mg">{formatMuscles(ex)}</span>
                </span>
                <span className="aes-row-uses">
                  {count > 0 ? `${count} ${count === 1 ? "time" : "times"}` : "—"}
                </span>
                <span className="aes-check" aria-hidden>
                  {isSelected && (
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
                </span>
              </button>
            );
          })}

          {filteredExercises.length === 0 && (
            <div className="aes-empty">No exercises found</div>
          )}
        </div>

        <div className="aes-footer">
          <button type="button" className="aes-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="aes-add"
            onClick={selected.size > 0 ? handleAdd : undefined}
            disabled={selected.size === 0}
          >
            {selected.size > 0 ? `Add Exercises (${selected.size})` : "Add Exercises"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
