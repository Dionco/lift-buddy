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
  onResume: () => void;
  onCancel: () => void;
}

export function WorkoutMiniBar({ workoutName, startTime, onResume, onCancel }: WorkoutMiniBarProps) {
  const elapsed = useElapsedTime(startTime);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cleanName =
    workoutName?.replace(/^Week\s*\d+\s*[·-]\s*Day\s*\d+\s*[—-]\s*/, '') ?? workoutName ?? 'Workout';

  return (
    <>
      <div className="lb-mini-bar" role="status" aria-label="Active session">
        <span className="lb-mini-dot" aria-hidden />
        <div className="lb-mini-body">
          <div className="lb-mini-eyebrow">
            <span>In session</span>
            <span className="lb-mini-eyebrow-dot">·</span>
            <span className="lb-mini-time">{elapsed}</span>
          </div>
          <span className="lb-mini-name">{cleanName}</span>
        </div>
        <button type="button" className="lb-mini-resume" onClick={onResume}>
          Resume
        </button>
        <button
          type="button"
          className="lb-mini-x"
          onClick={() => setConfirmOpen(true)}
          aria-label="Cancel workout"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
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
