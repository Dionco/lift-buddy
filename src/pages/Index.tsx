import { useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { ExerciseLog, ReadinessCheckIn } from '@/types/training';
import { BottomNav } from '@/components/BottomNav';
import { TrainTab } from '@/components/TrainTab';
import { ProgressTab } from '@/components/ProgressTab';
import { HistoryTab } from '@/components/HistoryTab';
import { ProgramOverview } from '@/components/ProgramOverview';
import { ReadinessCheck } from '@/components/ReadinessCheck';
import { WorkoutSheet } from '@/components/WorkoutSheet';
import { WorkoutMiniBar } from '@/components/WorkoutMiniBar';
import { SessionSummary } from '@/components/SessionSummary';

type Screen = 'tabs' | 'program' | 'readiness' | 'workout' | 'summary';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'train' | 'progress' | 'history'>('train');
  const [screen, setScreen] = useState<Screen>('tabs');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { startSession, setReadiness, activeSession, cancelSession } = useTrainingStore();
  const [pendingStart, setPendingStart] = useState<{
    name?: string;
    dayId?: string;
    exercises?: ExerciseLog[];
  } | null>(null);

  const handleStartWorkout = (exercises?: ExerciseLog[], name?: string, dayId?: string) => {
    setPendingStart({ name, dayId, exercises });
    setScreen('readiness');
  };

  const handleReadinessSubmit = (readiness: ReadinessCheckIn) => {
    startSession(pendingStart?.name, pendingStart?.dayId, pendingStart?.exercises);
    setReadiness(readiness);
    setPendingStart(null);
    setScreen('workout');
    setSheetOpen(true);
  };

  const handleReadinessSkip = () => {
    startSession(pendingStart?.name, pendingStart?.dayId, pendingStart?.exercises);
    setPendingStart(null);
    setScreen('workout');
    setSheetOpen(true);
  };

  const handleFinish = () => {
    setSheetOpen(false);
    setScreen('summary');
  };

  const handleCancelWorkout = () => {
    cancelSession();
    setSheetOpen(false);
    setScreen('tabs');
  };

  const handleSummaryClose = () => {
    setScreen('tabs');
  };

  if (screen === 'readiness') {
    return <ReadinessCheck onSubmit={handleReadinessSubmit} onSkip={handleReadinessSkip} />;
  }

  if (screen === 'summary' && activeSession) {
    return (
      <SessionSummary
        session={{ ...activeSession, endTime: Date.now() }}
        onClose={handleSummaryClose}
      />
    );
  }

  if (screen === 'program') {
    return <ProgramOverview onBack={() => setScreen('tabs')} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {activeTab === 'train' && (
        <TrainTab
          onStartEmpty={() => handleStartWorkout()}
          onStartToday={(exercises, name, dayId) => handleStartWorkout(exercises, name, dayId)}
          onViewProgram={() => setScreen('program')}
        />
      )}
      {activeTab === 'progress' && <ProgressTab />}
      {activeTab === 'history' && <HistoryTab />}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      {screen === 'workout' && activeSession && (
        <WorkoutMiniBar
          workoutName={activeSession.workoutName}
          startTime={activeSession.startTime}
          onResume={() => setSheetOpen(true)}
          onCancel={handleCancelWorkout}
        />
      )}
      {screen === 'workout' && activeSession && (
        <WorkoutSheet
          open={sheetOpen}
          onCollapse={() => setSheetOpen(false)}
          onFinish={handleFinish}
          onCancel={handleCancelWorkout}
        />
      )}
    </div>
  );
};

export default Index;
