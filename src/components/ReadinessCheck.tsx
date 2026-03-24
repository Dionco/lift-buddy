import { useState } from 'react';
import { ReadinessCheckIn } from '@/types/training';
import { Slider } from '@/components/ui/slider';
import { Moon, Zap, AlertCircle } from 'lucide-react';

interface ReadinessCheckProps {
  onSubmit: (readiness: ReadinessCheckIn) => void;
  onSkip: () => void;
}

export function ReadinessCheck({ onSubmit, onSkip }: ReadinessCheckProps) {
  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState(3);
  const [soreness, setSoreness] = useState(2);

  return (
    <div className="flex min-h-screen flex-col justify-between p-6 pb-24">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">How are you feeling?</h2>
        <p className="text-sm text-muted-foreground mb-8">Quick check before your session</p>

        <div className="flex flex-col gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Moon className="h-5 w-5 text-primary" />
              <span className="font-semibold">Sleep</span>
              <span className="ml-auto text-2xl font-bold tabular-nums">{sleep}h</span>
            </div>
            <Slider
              value={[sleep]}
              onValueChange={([v]) => setSleep(v)}
              min={4}
              max={10}
              step={0.5}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>4h</span><span>10h</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-semibold">Energy</span>
              <span className="ml-auto text-2xl font-bold tabular-nums">{energy}/5</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setEnergy(v)}
                  className={`flex-1 min-h-[48px] rounded-lg border text-lg font-semibold transition-colors ${
                    energy === v
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-primary" />
              <span className="font-semibold">Soreness</span>
              <span className="ml-auto text-2xl font-bold tabular-nums">{soreness}/5</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setSoreness(v)}
                  className={`flex-1 min-h-[48px] rounded-lg border text-lg font-semibold transition-colors ${
                    soreness === v
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-8">
        <button
          onClick={() => onSubmit({ sleep, energy, soreness })}
          className="min-h-[52px] w-full rounded-xl bg-primary font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
        >
          Continue
        </button>
        <button
          onClick={onSkip}
          className="min-h-[48px] w-full rounded-xl text-muted-foreground font-medium"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
