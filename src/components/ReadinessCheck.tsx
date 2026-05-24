import { useState } from 'react';
import { ReadinessCheckIn } from '@/types/training';

interface ReadinessCheckProps {
  onSubmit: (readiness: ReadinessCheckIn) => void;
  onSkip: () => void;
}

// Thresholds mirror docs/powerlifting-knowledge.md: sleep < 6h, energy ≤ 2,
// soreness ≥ 4 each trigger a flag. The readout block reflects the user's
// signals back to them and tells them how to scale the session.
function interpret({ sleep, energy, soreness }: ReadinessCheckIn) {
  const flags: string[] = [];
  if (sleep < 6)
    flags.push(`Sleep is low (${sleep}h). Consider cutting top-set intensity by ~5–10%.`);
  if (energy <= 2)
    flags.push(`Energy is low (${energy}/5). Cut total volume 20–30% — skip PRs.`);
  if (soreness >= 4)
    flags.push(
      `High residual soreness (${soreness}/5). Reduce volume in the still-sore muscles, or shift the day.`,
    );
  if (flags.length === 0) {
    return {
      status: 'good' as const,
      heading: 'Green light',
      body: 'No fatigue flags. Train as prescribed — push the top set if it moves well.',
    };
  }
  return {
    status: 'flagged' as const,
    heading: `${flags.length} signal${flags.length > 1 ? 's' : ''} flagged`,
    body: flags.join(' '),
  };
}

interface ScaleBtnProps {
  value: number;
  label: string;
  active: boolean;
  lowFlag?: boolean;
  onClick: (v: number) => void;
}

function ScaleBtn({ value, label, active, lowFlag, onClick }: ScaleBtnProps) {
  return (
    <button
      type="button"
      className={`rd-scale-btn ${active ? 'is-active' : ''} ${active && lowFlag ? 'is-low' : ''}`}
      onClick={() => onClick(value)}
    >
      <span>{value}</span>
      <span className="lbl">{label}</span>
    </button>
  );
}

export function ReadinessCheck({ onSubmit, onSkip }: ReadinessCheckProps) {
  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState(4);
  const [soreness, setSoreness] = useState(2);

  const readout = interpret({ sleep, energy, soreness });

  return (
    <div className="rd-backdrop" onClick={onSkip}>
      <div className="rd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rd-grab" />

        <div className="rd-head">
          <div className="rd-eyebrow">Check-in · Before session</div>
          <h2 className="rd-title">How are you feeling?</h2>
          <p className="rd-sub">
            Three quick reads. The session adjusts itself based on what you log.
          </p>
        </div>

        <div className="rd-body">
          {/* SLEEP — stepper */}
          <div className="rd-group">
            <div className="rd-group-head">
              <div className="rd-group-lbl">
                <span>Sleep</span>
                <span className="ix">LAST NIGHT</span>
              </div>
              <div className="rd-group-val">
                <span>{sleep}</span>
                <span className="u">HRS</span>
              </div>
            </div>
            <div className="rd-sleep">
              <button
                type="button"
                className="rd-sleep-btn"
                onClick={() => setSleep((s) => Math.max(4, +(s - 0.5).toFixed(1)))}
                disabled={sleep <= 4}
                aria-label="Less sleep"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <div className="rd-sleep-val">
                <span className="v">{sleep}</span>
                <span className="u">hrs</span>
              </div>
              <button
                type="button"
                className="rd-sleep-btn"
                onClick={() => setSleep((s) => Math.min(10, +(s + 0.5).toFixed(1)))}
                disabled={sleep >= 10}
                aria-label="More sleep"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <line x1="12" y1="5" x2="12" y2="19" />
                </svg>
              </button>
            </div>
            <div className="rd-sleep-scale">
              <span>4 LOW</span>
              <span>7 IDEAL</span>
              <span>10 HIGH</span>
            </div>
          </div>

          {/* ENERGY — 1..5 */}
          <div className="rd-group">
            <div className="rd-group-head">
              <div className="rd-group-lbl">
                <span>Energy</span>
                <span className="ix">RIGHT NOW</span>
              </div>
              <div className="rd-group-val">
                <span>{energy}</span>
                <span className="u">/ 5</span>
              </div>
            </div>
            <div className="rd-scale">
              <ScaleBtn value={1} label="Flat" active={energy === 1} onClick={setEnergy} lowFlag />
              <ScaleBtn value={2} label="Low" active={energy === 2} onClick={setEnergy} lowFlag />
              <ScaleBtn value={3} label="OK" active={energy === 3} onClick={setEnergy} />
              <ScaleBtn value={4} label="Good" active={energy === 4} onClick={setEnergy} />
              <ScaleBtn value={5} label="Primed" active={energy === 5} onClick={setEnergy} />
            </div>
          </div>

          {/* SORENESS — 1..5 */}
          <div className="rd-group">
            <div className="rd-group-head">
              <div className="rd-group-lbl">
                <span>Soreness</span>
                <span className="ix">TRAINED MUSCLES</span>
              </div>
              <div className="rd-group-val">
                <span>{soreness}</span>
                <span className="u">/ 5</span>
              </div>
            </div>
            <div className="rd-scale">
              <ScaleBtn value={1} label="None" active={soreness === 1} onClick={setSoreness} />
              <ScaleBtn value={2} label="Mild" active={soreness === 2} onClick={setSoreness} />
              <ScaleBtn value={3} label="Mod" active={soreness === 3} onClick={setSoreness} />
              <ScaleBtn value={4} label="Heavy" active={soreness === 4} onClick={setSoreness} lowFlag />
              <ScaleBtn value={5} label="Acute" active={soreness === 5} onClick={setSoreness} lowFlag />
            </div>
          </div>

          {/* READOUT */}
          <div className={`rd-readout ${readout.status === 'flagged' ? 'is-flagged' : ''}`}>
            <div className="rd-readout-head">
              <span className="dot" />
              <span>{readout.heading}</span>
            </div>
            <div className="rd-readout-body">{readout.body}</div>
          </div>
        </div>

        <div className="rd-actions">
          <button type="button" className="rd-act-secondary" onClick={onSkip}>
            Skip
          </button>
          <button
            type="button"
            className="rd-act-primary"
            onClick={() => onSubmit({ sleep, energy, soreness })}
          >
            Save<span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
