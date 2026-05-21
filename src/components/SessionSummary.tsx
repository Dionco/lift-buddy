import { useState, useMemo } from 'react';
import {
  Session,
  diffSessionAgainstDay,
} from '@/types/training';
import { topSetE1rm } from '@/lib/e1rm';
import { sessionStats } from '@/lib/sessionStats';
import {
  findDayById,
  computeBlockBoundaryChoice,
  type BlockBoundaryChoice,
} from '@/lib/programCursor';
import { useTrainingStore } from '@/store/useTrainingStore';
import { Textarea } from '@/components/ui/textarea';
import { Clock, BarChart3, Activity, Trophy, AlertCircle, Plus } from 'lucide-react';

interface SessionSummaryProps {
  session: Session;
  /**
   * Called after the lifter has decided to close the summary. Receives the note
   * and a flag for whether the program cursor should advance. The parent owns
   * navigation; this component owns persistence (finishSession + advanceProgramCursor).
   */
  onClose: () => void;
}

type EndOfBlockChoice = BlockBoundaryChoice | null;

export function SessionSummary({ session, onClose }: SessionSummaryProps) {
  const program = useTrainingStore((s) => s.program);
  const finishSession = useTrainingStore((s) => s.finishSession);
  const advanceProgramCursor = useTrainingStore((s) => s.advanceProgramCursor);
  const setProgramCursor = useTrainingStore((s) => s.setProgramCursor);

  const [note, setNote] = useState(session.note || '');
  const [endOfBlockOpen, setEndOfBlockOpen] = useState(false);

  const programDayLocation = useMemo(
    () => (session.programDayId ? findDayById(program, session.programDayId) : null),
    [program, session.programDayId]
  );

  const stats = useMemo(() => {
    const base = sessionStats(session);

    const topSetE1RMs: { name: string; e1rm: number; isMainLift: boolean }[] = [];
    for (const ex of session.exercises) {
      const e1rm = topSetE1rm(ex.sets);
      if (e1rm > 0) {
        topSetE1RMs.push({ name: ex.exercise.name, e1rm, isMainLift: ex.exercise.isMainLift });
      }
    }
    topSetE1RMs.sort((a, b) => Number(b.isMainLift) - Number(a.isMainLift));

    return { ...base, topSetE1RMs };
  }, [session]);

  const diff = useMemo(
    () => (programDayLocation ? diffSessionAgainstDay(session, programDayLocation.day) : null),
    [session, programDayLocation]
  );

  const closeWithoutAdvance = () => {
    finishSession(note || undefined);
    onClose();
  };

  const closeAndAdvance = () => {
    finishSession(note || undefined);
    const result = advanceProgramCursor();
    if (result.blockBoundaryCrossed && !result.programComplete) {
      setEndOfBlockOpen(true);
      return;
    }
    onClose();
  };

  const handleEndOfBlockChoice = (choice: EndOfBlockChoice) => {
    if (!programDayLocation || !choice) {
      setEndOfBlockOpen(false);
      onClose();
      return;
    }
    const next = computeBlockBoundaryChoice(program, programDayLocation, choice);
    if (next) {
      setProgramCursor(next.blockIndex, next.weekIndex, next.dayIndex);
    }
    setEndOfBlockOpen(false);
    onClose();
  };

  return (
    <div className="flex min-h-screen flex-col p-6 pb-24">
      <h2 className="text-2xl font-bold text-foreground mb-1">Session Complete 🎉</h2>
      <p className="text-sm text-muted-foreground mb-6">{session.workoutName || 'Custom Workout'}</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
          <BarChart3 className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold">{stats.completedSets}</span>
          <span className="text-xs text-muted-foreground">Sets</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
          <Clock className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold">{stats.durationMinutes ?? 0}</span>
          <span className="text-xs text-muted-foreground">Min</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
          <Activity className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold">
            {stats.avgRpe !== null ? stats.avgRpe.toFixed(1) : '—'}
          </span>
          <span className="text-xs text-muted-foreground">Avg RPE</span>
        </div>
      </div>

      {stats.topSetE1RMs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Top Set e1RM
          </h3>
          <div className="flex flex-col gap-2">
            {stats.topSetE1RMs.map(({ name, e1rm, isMainLift }) => (
              <div
                key={name}
                className={
                  isMainLift
                    ? 'flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4'
                    : 'flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3'
                }
              >
                <span className={isMainLift ? 'font-semibold text-foreground' : 'text-sm font-medium text-foreground/90'}>
                  {name}
                </span>
                <span className={isMainLift ? 'text-xl font-bold text-primary' : 'text-base font-semibold text-foreground'}>
                  {Math.round(e1rm)} kg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff && (diff.skipped.length > 0 || diff.bonus.length > 0 || diff.missedReps.length > 0) && (
        <div className="mb-6 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Vs Prescription</h3>

          {diff.skipped.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" /> Prescribed but not done
              </p>
              <ul className="flex flex-col gap-1">
                {diff.skipped.map((pe) => (
                  <li key={pe.exercise.id} className="text-sm text-foreground/90">
                    {pe.exercise.name}
                    <span className="text-muted-foreground ml-2">
                      ({pe.prescription.sets}×{pe.prescription.reps})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diff.bonus.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Plus className="h-3 w-3" /> Bonus exercises
              </p>
              <ul className="flex flex-col gap-1">
                {diff.bonus.map((log) => {
                  const completed = log.sets.filter((s) => s.completed).length;
                  return (
                    <li key={log.exercise.id} className="text-sm text-foreground/90">
                      {log.exercise.name}
                      <span className="text-muted-foreground ml-2">({completed} sets)</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {diff.missedReps.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Missed reps
              </p>
              <ul className="flex flex-col gap-1">
                {diff.missedReps.map((m, i) => (
                  <li key={i} className="text-sm text-foreground/90">
                    {m.exercise.name}
                    <span className="text-muted-foreground ml-2">
                      got {m.setLog.reps} (prescribed {m.prescribedReps})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <label className="text-sm font-semibold text-muted-foreground mb-2 block">Session Notes</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="How did it feel? Anything to note..."
          className="min-h-[100px] text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={closeAndAdvance}
          className="min-h-[52px] w-full rounded-xl bg-primary font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
          disabled={!session.programDayId}
        >
          {session.programDayId ? 'Mark complete & advance program' : 'Save & close'}
        </button>
        {session.programDayId && (
          <button
            onClick={closeWithoutAdvance}
            className="min-h-[44px] w-full rounded-xl border border-border bg-background font-medium text-muted-foreground active:scale-[0.98] transition-transform text-sm"
          >
            Save without advancing cursor
          </button>
        )}
      </div>

      {endOfBlockOpen && programDayLocation && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-background p-6 sm:rounded-2xl">
            <h3 className="text-lg font-bold text-foreground mb-1">End of Block</h3>
            <p className="text-sm text-muted-foreground mb-5">
              You've finished the last day of <strong>{program.blocks[programDayLocation.blockIndex]?.name}</strong>.
              What's next?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleEndOfBlockChoice('advance')}
                className="min-h-[52px] w-full rounded-xl bg-primary font-semibold text-primary-foreground active:scale-[0.98]"
              >
                Advance to next Block
              </button>
              <button
                onClick={() => handleEndOfBlockChoice('repeat')}
                className="min-h-[48px] w-full rounded-xl border border-border bg-card font-medium text-foreground active:scale-[0.98]"
              >
                Repeat this Block
              </button>
              <button
                onClick={() => handleEndOfBlockChoice('deload')}
                className="min-h-[48px] w-full rounded-xl border border-border bg-card font-medium text-foreground active:scale-[0.98]"
              >
                Insert a deload week
              </button>
              <button
                onClick={() => handleEndOfBlockChoice(null)}
                className="min-h-[44px] w-full rounded-xl text-sm font-medium text-muted-foreground"
              >
                Decide later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
