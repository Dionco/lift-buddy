import { useMemo, useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { ExerciseLog, ReadinessCheckIn, TrainingMaxes } from '@/types/training';
import { isSameCalendarDay } from '@/lib/sameCalendarDay';
import { BottomNav } from '@/components/BottomNav';
import { TrainTab } from '@/components/TrainTab';
import { ProgressTab } from '@/components/ProgressTab';
import { HistoryTab } from '@/components/HistoryTab';
import { ProgramOverview } from '@/components/ProgramOverview';
import { ReadinessCheck } from '@/components/ReadinessCheck';
import { TrainingMaxesSetup } from '@/components/TrainingMaxesSetup';
import { ActiveWorkout, type SessionStats } from '@/components/ActiveWorkout';
import { WorkoutMiniBar } from '@/components/WorkoutMiniBar';
import { SessionSummary } from '@/components/SessionSummary';

type Screen = 'tabs' | 'program' | 'maxes' | 'readiness' | 'workout' | 'summary';
const MINIMIZE_THRESHOLD = 140;

const Index = () => {
  const [activeTab, setActiveTab] = useState<'train' | 'progress' | 'history'>('train');
  const [screen, setScreen] = useState<Screen>('tabs');
  // Pre-fill for the Training Maxes editor. Used when the lifter opens the
  // editor in "Update" mode from ProgramOverview (vs blank first-time setup).
  const [maxesInitial, setMaxesInitial] = useState<Partial<TrainingMaxes> | undefined>(undefined);
  // When the workout screen is up, sessionMinimized=false shows the full session
  // frame; true shows just the mini bar over the tab bar.
  const [sessionMinimized, setSessionMinimized] = useState(false);
  const { startSession, setReadiness, activeSession, cancelSession } = useTrainingStore();
  const lastReadiness = useTrainingStore((s) => s.lastReadiness);
  const [pendingStart, setPendingStart] = useState<{
    name?: string;
    dayId?: string;
    exercises?: ExerciseLog[];
  } | null>(null);

  // Drag state — drives the session-frame transform while the user drags.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Stats reported by ActiveWorkout — keep the mini bar in sync.
  const [stats, setStats] = useState<SessionStats>({ doneSets: 0, totalSets: 0 });

  const handleStartWorkout = (exercises?: ExerciseLog[], name?: string, dayId?: string) => {
    // Same-day reuse: if the lifter already filled in Readiness today, don't
    // re-prompt — start the Session and replay the saved check-in. The cancel
    // path discards activeSession but `lastReadiness` is persisted on the
    // store, so a cancel + restart on the same day flows straight to the
    // workout screen.
    if (lastReadiness && isSameCalendarDay(lastReadiness.timestamp, Date.now())) {
      startSession(name, dayId, exercises);
      setReadiness(lastReadiness.readiness);
      setScreen('workout');
      setSessionMinimized(false);
      return;
    }
    setPendingStart({ name, dayId, exercises });
    setScreen('readiness');
  };

  const handleReadinessSubmit = (readiness: ReadinessCheckIn) => {
    startSession(pendingStart?.name, pendingStart?.dayId, pendingStart?.exercises);
    setReadiness(readiness);
    setPendingStart(null);
    setScreen('workout');
    setSessionMinimized(false);
  };

  const handleReadinessSkip = () => {
    startSession(pendingStart?.name, pendingStart?.dayId, pendingStart?.exercises);
    setPendingStart(null);
    setScreen('workout');
    setSessionMinimized(false);
  };

  const handleFinish = () => {
    setSessionMinimized(false);
    setScreen('summary');
  };

  const handleCancelWorkout = () => {
    cancelSession();
    setSessionMinimized(false);
    setScreen('tabs');
  };

  const handleSummaryClose = () => {
    setScreen('tabs');
  };

  const minimize = () => {
    setSessionMinimized(true);
    setDragY(0);
  };
  const resume = () => {
    setSessionMinimized(false);
    setDragY(0);
  };

  // Session frame transform — scale + fade while the user drags downward.
  const frameStyle = useMemo<React.CSSProperties>(() => {
    if (sessionMinimized) return {};
    if (dragY === 0) return {};
    const frac = Math.min(1, dragY / 400);
    const scale = 1 - frac * 0.18;
    const ty = dragY * 0.55;
    const radius = 16 + frac * 16;
    return {
      transform: `translateY(${ty}px) scale(${scale})`,
      borderRadius: `${radius}px`,
      opacity: 1 - frac * 0.3,
    };
  }, [dragY, sessionMinimized]);

  const handleDragStart = () => setDragging(true);
  const handleDrag = (dy: number) => setDragY(dy);
  const handleDragEnd = (dy: number) => {
    setDragging(false);
    if (dy > MINIMIZE_THRESHOLD) {
      // Snap to minimized: jump frame off-screen, then swap state.
      setDragY(800);
      setTimeout(() => {
        setSessionMinimized(true);
        setDragY(0);
      }, 220);
    } else {
      setDragY(0);
    }
  };

  if (screen === 'readiness') {
    return (
      <ReadinessCheck onSubmit={handleReadinessSubmit} onSkip={handleReadinessSkip} />
    );
  }

  if (screen === 'summary' && activeSession) {
    return (
      <SessionSummary
        session={{ ...activeSession, endTime: Date.now() }}
        onClose={handleSummaryClose}
        onProgramComplete={(projection) => {
          // Lifter chose "project new Training Maxes & restart" — both the
          // session-save and program-restart have already been applied by
          // SessionSummary. We just route to the editor with the projection
          // pre-filled, so the lifter can sanity-check and save.
          setMaxesInitial(projection);
          setScreen('maxes');
        }}
      />
    );
  }

  if (screen === 'program') {
    return (
      <ProgramOverview
        onBack={() => setScreen('tabs')}
        onRestart={() => {
          // Restart clears Training Maxes (see store.restartProgram), so the
          // editor opens blank and the lifter enters fresh post-block numbers.
          setMaxesInitial(undefined);
          setScreen('maxes');
        }}
        onUpdateMaxes={(initial) => {
          setMaxesInitial(initial);
          setScreen('maxes');
        }}
      />
    );
  }

  if (screen === 'maxes') {
    return (
      <TrainingMaxesSetup
        initial={maxesInitial}
        onSubmit={() => {
          setMaxesInitial(undefined);
          setScreen('tabs');
        }}
        onCancel={() => {
          setMaxesInitial(undefined);
          setScreen('tabs');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {activeTab === 'train' && (
        <TrainTab
          onStartEmpty={() => handleStartWorkout()}
          onStartToday={(exercises, name, dayId) => handleStartWorkout(exercises, name, dayId)}
          onViewProgram={() => setScreen('program')}
          onSetupMaxes={() => {
            setMaxesInitial(undefined);
            setScreen('maxes');
          }}
          onUpdateMaxes={(initial) => {
            setMaxesInitial(initial);
            setScreen('maxes');
          }}
        />
      )}
      {activeTab === 'progress' && <ProgressTab />}
      {activeTab === 'history' && <HistoryTab />}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* MINI BAR — shown when the active session is minimized */}
      {screen === 'workout' && activeSession && (
        <WorkoutMiniBar
          workoutName={activeSession.workoutName}
          startTime={activeSession.startTime}
          currentExerciseName={stats.currentExerciseName}
          doneSets={stats.doneSets}
          totalSets={stats.totalSets}
          visible={sessionMinimized}
          onResume={resume}
          onCancel={handleCancelWorkout}
        />
      )}

      {/* SESSION FRAME — full-screen overlay; drag the handle to minimize */}
      {screen === 'workout' && activeSession && (
        <div
          className={`session-frame ${dragging ? 'is-dragging' : ''} ${
            sessionMinimized ? 'is-minimized' : ''
          }`}
          style={frameStyle}
        >
          <ActiveWorkout
            onFinish={handleFinish}
            onMinimize={minimize}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onStatsChange={setStats}
          />
        </div>
      )}
    </div>
  );
};

export default Index;
