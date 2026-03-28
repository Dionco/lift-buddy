import { useElapsedTime } from "@/hooks/useElapsedTime";

interface WorkoutMiniBarProps {
  workoutName: string | undefined;
  startTime: number;
  onResume: () => void;
  onCancel: () => void;
}

export function WorkoutMiniBar({ workoutName, startTime, onResume, onCancel }: WorkoutMiniBarProps) {
  const elapsed = useElapsedTime(startTime);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 64,
        left: 0,
        right: 0,
        zIndex: 49,
        background: "#FFFFFF",
        borderTop: "0.5px solid #D3D1C7",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 16px",
        height: 52,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Dumbbell icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "#7F77DD" }}>
        <rect x="1" y="7" width="3" height="2" rx="0.5" fill="currentColor" />
        <rect x="12" y="7" width="3" height="2" rx="0.5" fill="currentColor" />
        <rect x="3" y="5.5" width="2" height="5" rx="0.5" fill="currentColor" />
        <rect x="11" y="5.5" width="2" height="5" rx="0.5" fill="currentColor" />
        <rect x="5" y="7.5" width="6" height="1" rx="0.5" fill="currentColor" />
      </svg>

      {/* Workout name */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 600,
          color: "#2C2C2A",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {workoutName ?? "Workout"}
      </span>

      {/* Elapsed time */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#888780",
          flexShrink: 0,
          marginRight: 8,
        }}
      >
        {elapsed}
      </span>

      {/* Resume button */}
      <button
        onClick={onResume}
        style={{
          background: "#7F77DD",
          color: "white",
          border: "none",
          borderRadius: 16,
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Resume
      </button>

      {/* Cancel (X) button */}
      <button
        onClick={onCancel}
        style={{
          background: "none",
          border: "none",
          padding: 6,
          cursor: "pointer",
          color: "#888780",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
