import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface RestTimerProps {
  duration: number;
  onDismiss: () => void;
}

export function RestTimer({ duration, onDismiss }: RestTimerProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    setRemaining(duration);
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [duration]);

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }, []);

  const progress = ((duration - remaining) / duration) * 100;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="relative h-10 w-10">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="16" fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeDasharray="100.53"
            strokeDashoffset={100.53 * (1 - progress / 100)}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">Rest Timer</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{formatTime(remaining)}</p>
      </div>
      <button
        onClick={onDismiss}
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary active:scale-95 transition-transform"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
