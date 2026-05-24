import { useMemo, useState } from 'react';
import { useTrainingStore } from '@/store/useTrainingStore';
import { TrainingMaxes } from '@/types/training';
import { projectTrainingMaxes } from '@/lib/projectTrainingMaxes';

interface TrainingMaxesSetupProps {
  onSubmit: () => void;
  onCancel: () => void;
  /** Optional pre-fill when the lifter is updating Training Maxes after a test
   *  day, or projecting fresh ones at the end of a block. */
  initial?: Partial<TrainingMaxes>;
}

interface MaxFieldProps {
  label: string;
  sub: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  /** Origin tag: when the field was seeded from session history we surface
   *  that so the lifter knows the number is a suggestion, not their last
   *  entered value. */
  fromHistory?: boolean;
}

function MaxField({ label, sub, value, onChange, hint, fromHistory }: MaxFieldProps) {
  return (
    <div className="um-field">
      <div className="um-field-head">
        <div className="um-field-lbl">
          <span>{label}</span>
          <span className="ix">{sub}</span>
        </div>
        {fromHistory && (
          <span className="um-field-source">From your logged sessions</span>
        )}
      </div>
      <div className="um-field-input">
        <input
          // `type="number"` is unreliable across mobile browsers — iOS Safari
          // sometimes still shows the full QWERTY keyboard. `type="text"` +
          // `inputMode="decimal"` is the canonical pattern for "give me the
          // decimal numpad on phones, no spinners on desktop, no surprise
          // keyboards".
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            // Strip everything except digits and a single separator. We accept
            // both '.' and ',' (some locales' numpads emit ',') and normalise
            // to '.' so `parseFloat` reads it correctly.
            const cleaned = e.target.value
              .replace(/[^\d.,]/g, '')
              .replace(',', '.');
            // Collapse any extra dots — keep only the first.
            const firstDot = cleaned.indexOf('.');
            const normalised =
              firstDot === -1
                ? cleaned
                : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
            onChange(normalised);
          }}
          placeholder="—"
          aria-label={`${label} Training Max`}
        />
        <span className="um-field-unit">kg</span>
      </div>
      <div className="um-field-hint">{hint}</div>
    </div>
  );
}

const FIELD_HINT =
  'Use a recent tested 1RM, or knock 5% off your best e1RM. Conservative is better — you can update mid-program.';

export function TrainingMaxesSetup({ onSubmit, onCancel, initial }: TrainingMaxesSetupProps) {
  const setTrainingMaxes = useTrainingStore((s) => s.setTrainingMaxes);
  const setLoadingIncrement = useTrainingStore((s) => s.setLoadingIncrement);
  const loadingIncrement = useTrainingStore((s) => s.loadingIncrement);
  const sessions = useTrainingStore((s) => s.sessions);

  // Project best-of-the-trailing-8-weeks top-set e1RMs as fallback seeds.
  // `initial` (from an Update flow) always wins — projection only fills empty
  // slots so the lifter never sees a recommendation overwrite their last
  // entered Training Max.
  const projected = useMemo(
    () => projectTrainingMaxes(sessions, { now: Date.now(), loadingIncrement }),
    [sessions, loadingIncrement],
  );
  const seedSquat = initial?.squat ?? projected.squat;
  const seedBench = initial?.bench ?? projected.bench;
  const seedDeadlift = initial?.deadlift ?? projected.deadlift;
  const squatFromHistory = initial?.squat == null && projected.squat != null;
  const benchFromHistory = initial?.bench == null && projected.bench != null;
  const deadliftFromHistory = initial?.deadlift == null && projected.deadlift != null;

  const [squat, setSquat] = useState(seedSquat ? String(seedSquat) : '');
  const [bench, setBench] = useState(seedBench ? String(seedBench) : '');
  const [deadlift, setDeadlift] = useState(seedDeadlift ? String(seedDeadlift) : '');
  const [increment, setIncrement] = useState(loadingIncrement);

  const sNum = parseFloat(squat);
  const bNum = parseFloat(bench);
  const dNum = parseFloat(deadlift);
  const valid =
    Number.isFinite(sNum) && sNum > 0 &&
    Number.isFinite(bNum) && bNum > 0 &&
    Number.isFinite(dNum) && dNum > 0;

  const handleSubmit = () => {
    if (!valid) return;
    setTrainingMaxes({ squat: sNum, bench: bNum, deadlift: dNum });
    setLoadingIncrement(increment);
    onSubmit();
  };

  return (
    // Backdrop intentionally does NOT dismiss on click — losing a half-filled
    // Training Max edit to a stray tap is a footgun. Cancel is explicit.
    <div className="rd-backdrop">
      <div className="rd-sheet tm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rd-grab" />

        <div className="rd-head">
          <div className="rd-eyebrow">Setup · Training Maxes</div>
          <h2 className="rd-title">Enter your Training Maxes</h2>
          <p className="rd-sub">
            All program weights are computed from these three numbers. A Training Max is your
            self-set baseline — typically a recent tested 1RM or a deliberately conservative
            number so autoregulation stays honest.
          </p>
        </div>

        <div className="rd-body">
          <div className="um-fields">
            <MaxField
              label="Squat"
              sub="COMPETITION DEPTH"
              value={squat}
              onChange={setSquat}
              hint={FIELD_HINT}
              fromHistory={squatFromHistory}
            />
            <MaxField
              label="Bench Press"
              sub="COMP PAUSE"
              value={bench}
              onChange={setBench}
              hint={FIELD_HINT}
              fromHistory={benchFromHistory}
            />
            <MaxField
              label="Deadlift"
              sub="CONVENTIONAL OR SUMO"
              value={deadlift}
              onChange={setDeadlift}
              hint={FIELD_HINT}
              fromHistory={deadliftFromHistory}
            />
          </div>

          <div className="um-increment">
            <div className="um-increment-head">
              <span className="lbl">Loading increment</span>
              <span className="ix">PLATE PAIR ON THE BAR</span>
            </div>
            <div className="um-increment-opts">
              <button
                type="button"
                className={`um-increment-opt ${increment === 2.5 ? 'is-active' : ''}`}
                onClick={() => setIncrement(2.5)}
              >
                <span className="v">2.5</span>
                <span className="u">kg</span>
                <span className="sub">Standard</span>
              </button>
              <button
                type="button"
                className={`um-increment-opt ${increment === 1.25 ? 'is-active' : ''}`}
                onClick={() => setIncrement(1.25)}
              >
                <span className="v">1.25</span>
                <span className="u">kg</span>
                <span className="sub">Fractional</span>
              </button>
              <button
                type="button"
                className={`um-increment-opt ${increment === 5 ? 'is-active' : ''}`}
                onClick={() => setIncrement(5)}
              >
                <span className="v">5</span>
                <span className="u">kg</span>
                <span className="sub">Coarse</span>
              </button>
            </div>
          </div>

          <div className="rd-readout">
            <div className="rd-readout-head">
              <span className="dot" />
              <span>Why this matters</span>
            </div>
            <div className="rd-readout-body">
              The Candito Hybrid program prescribes percentages of your Training Maxes — 80%
              squats, 95% bench singles, etc. After the Week 5 test sets the projection chart
              will give you new Training Maxes. Restart the program to enter them.
            </div>
          </div>
        </div>

        <div className="rd-actions">
          <button type="button" className="rd-act-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rd-act-primary"
            onClick={handleSubmit}
            disabled={!valid}
          >
            Save<span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
