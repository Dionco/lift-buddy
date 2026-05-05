import { useState, useMemo } from 'react';
import {
  Session,
  Program,
  ProgramDay,
  diffSessionAgainstDay,
  getTopSetE1RM,
} from '@/types/training';
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

interface ProgramDayLocation {
  day: ProgramDay;
  blockIndex: number;
  weekIndex: number;
  dayIndex: number;
}

function findProgramDay(program: Program, dayId: string): ProgramDayLocation | null {
  for (let bi = 0; bi < program.blocks.length; bi++) {
    const block = program.blocks[bi];
    for (let wi = 0; wi < block.weeks.length; wi++) {
      const week = block.weeks[wi];
      for (let di = 0; di < week.days.length; di++) {
        if (week.days[di].id === dayId) {
          return { day: week.days[di], blockIndex: bi, weekIndex: wi, dayIndex: di };
        }
      }
    }
  }
  return null;
}

type EndOfBlockChoice = 'advance' | 'repeat' | 'deload' | null;

export function SessionSummary({ session, onClose }: SessionSummaryProps) {
  const program = useTrainingStore((s) => s.program);
  const finishSession = useTrainingStore((s) => s.finishSession);
  const advanceProgramCursor = useTrainingStore((s) => s.advanceProgramCursor);
  const setProgramCursor = useTrainingStore((s) => s.setProgramCursor);

  const [note, setNote] = useState(session.note || '');
  const [endOfBlockOpen, setEndOfBlockOpen] = useState(false);

  const programDayLocation = useMemo(
    () => (session.programDayId ? findProgramDay(program, session.programDayId) : null),
    [program, session.programDayId]
  );

  const stats = useMemo(() => {
    const totalSets = session.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0
    );
    const duration = session.endTime
      ? Math.round((session.endTime - session.startTime) / 60000)
      : 0;
    const allRpes = session.exercises.flatMap((ex) =>
      ex.sets.filter((s) => s.completed).map((s) => s.rpe)
    );
    const avgRpe = allRpes.length > 0
      ? (allRpes.reduce((a, b) => a + b, 0) / allRpes.length).toFixed(1)
      : '—';

    const topSetE1RMs: { name: string; e1rm: number; isMainLift: boolean }[] = [];
    for (const ex of session.exercises) {
      const e1rm = getTopSetE1RM(ex.sets);
      if (e1rm > 0) {
        topSetE1RMs.push({ name: ex.exercise.name, e1rm, isMainLift: ex.exercise.isMainLift });
      }
    }
    topSetE1RMs.sort((a, b) => Number(b.isMainLift) - Number(a.isMainLift));

    return { totalSets, duration, avgRpe, topSetE1RMs };
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
    if (!programDayLocation) {
      onClose();
      return;
    }
    const { blockIndex, weekIndex } = programDayLocation;

    if (choice === 'advance') {
      // Move to first day of first week of next block.
      const nextBlock = blockIndex + 1;
      if (nextBlock < program.blocks.length) {
        setProgramCursor(nextBlock, 0, 0);
      }
    } else if (choice === 'repeat') {
      // Restart at the first day of the first week of the same block.
      setProgramCursor(blockIndex, 0, 0);
    } else if (choice === 'deload') {
      // Stay on the current block; restart at week 0 day 0 with the lifter expected
      // to manually adjust load. We don't model deload as data here (per ADR-0002 spirit:
      // we don't auto-apply training adjustments). The lifter knows what to do.
      setProgramCursor(blockIndex, weekIndex, 0);
    }
    // 'jump' would open a picker — out of scope for this phase. For now treat as no-op.
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
          <span className="text-2xl font-bold">{stats.totalSets}</span>
          <span className="text-xs text-muted-foreground">Sets</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
          <Clock className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold">{stats.duration}</span>
          <span className="text-xs text-muted-foreground">Min</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4">
          <Activity className="h-5 w-5 text-primary mb-1" />
          <span className="text-2xl font-bold">{stats.avgRpe}</span>
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
