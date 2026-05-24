import { useState } from "react";
import { useElapsedTime } from "@/hooks/useElapsedTime";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WorkoutMiniBarProps {
  workoutName: string | undefined;
  startTime: number;
  currentExerciseName?: string;
  doneSets?: number;
  totalSets?: number;
  visible?: boolean;
  onResume: () => void;
  onCancel: () => void;
}

export function WorkoutMiniBar({
  workoutName,
  startTime,
  currentExerciseName,
  doneSets = 0,
  totalSets = 0,
  visible = true,
  onResume,
  onCancel,
}: WorkoutMiniBarProps) {
  const elapsed = useElapsedTime(startTime);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cleanName =
    workoutName?.replace(/^Week\s*\d+\s*[·-]\s*Day\s*\d+\s*[—-]\s*/, '') ?? workoutName ?? 'Workout';
  const displayName = currentExerciseName || cleanName;
  const progress = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;

  return (
    <>
      <div className={`mb2-anchor ${visible ? 'is-visible' : ''}`} role="status" aria-label="Active session">
        <div className="mb2">
          <button type="button" className="mb2-icon" onClick={onResume} aria-label="Resume session">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {/* Outer caps */}
              <rect x="1.5" y="9.5" width="2" height="5" rx="0.7" />
              <rect x="20.5" y="9.5" width="2" height="5" rx="0.7" />
              {/* Plates */}
              <rect x="4.5" y="6.5" width="3.2" height="11" rx="1.1" />
              <rect x="16.3" y="6.5" width="3.2" height="11" rx="1.1" />
              {/* Bar */}
              <rect x="7.7" y="11" width="8.6" height="2" rx="0.6" />
            </svg>
          </button>
          <button type="button" className="mb2-body" onClick={onResume}>
            <div className="mb2-eyebrow">
              <span className="accent">IN SESSION</span>
              <span className="dot">·</span>
              <span>{elapsed}</span>
              {totalSets > 0 && (
                <>
                  <span className="dot">·</span>
                  <span>
                    {doneSets}/{totalSets} SETS
                  </span>
                </>
              )}
            </div>
            <div className="mb2-name">{displayName}</div>
          </button>
          <button type="button" className="mb2-resume" onClick={onResume}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Resume
          </button>
          <button
            type="button"
            className="mb2-x"
            onClick={() => setConfirmOpen(true)}
            aria-label="End session"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <div className="mb2-bar">
            <div className="mb2-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              {cleanName} is in progress for {elapsed}. Cancelling discards all logged sets — this
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep training</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onCancel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard workout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
