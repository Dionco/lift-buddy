# Powerlifting Knowledge Base

Evidence-based powerlifting principles for use as development context and as a future in-app coaching system prompt. Covers programming, fatigue, RPE, and the main lifts.

---

## 1. RPE & RIR

**RPE (Rating of Perceived Exertion)** in powerlifting uses a 6–10 scale where:

| RPE | RIR (Reps in Reserve) | Meaning |
|-----|----------------------|---------|
| 10  | 0 | Max effort — could not complete another rep |
| 9.5 | 0–1 | Could maybe get 1 more rep |
| 9   | 1 | Could definitely get 1 more rep |
| 8.5 | 1–2 | Could get 1, maybe 2 more |
| 8   | 2 | Could get 2 more reps |
| 7   | 3 | Could get 3 more reps |
| 6   | 4+ | Relatively easy |

Values below RPE 6 are not used in this app — all logged sets are assumed to be at least moderately challenging.

**Key principles:**
- RPE is subjective and requires calibration — newer lifters tend to underestimate (think they're at RPE 8 when closer to 9.5).
- RPE is more useful for autoregulation than fixed percentage loading, especially for intermediate/advanced lifters.
- The same absolute weight will produce a higher RPE when the lifter is fatigued — this is called RPE drift.
- RPE drift is a signal of accumulated fatigue. If Week 3 feels like RPE 9 at the same load that felt like RPE 7.5 in Week 1, fatigue is accumulating as intended (or too fast).
- RPE 6–7 work is low-fatigue and useful for technique and volume accumulation. RPE 9–10 work is high-fatigue and should be used sparingly outside of peaking phases.

**App relevance:** The `SetLog` type stores RPE per set. The e1RM calculation uses RPE to compute effective reps. Readiness check-in (energy, sleep, soreness) provides indirect evidence of systemic fatigue state.

---

## 2. e1RM (Estimated 1-Rep Max)

**Formula used in this app (Epley, RPE-adjusted):**
```
effectiveReps = reps + (10 - rpe)
e1RM = weight / (1.0278 - 0.0278 × effectiveReps)
```

**Standard Epley (no RPE adjustment):**
```
e1RM = weight × (1 + reps / 30)
```

The RPE-adjusted version is more useful for powerlifting because it accounts for proximity to failure. A set of 3 at RPE 9 (1 RIR) and a set of 3 at RPE 7 (3 RIR) should produce different e1RM estimates.

**Accuracy considerations:**
- Most accurate at 1–5 reps. Error increases significantly above 10 reps.
- Should be used for trend tracking (is this lifter getting stronger over time?) not absolute predictions.
- Compare e1RM across sets of similar rep ranges for meaningful comparisons.
- Cold comparisons between, e.g., a 3RM and a 10RM e1RM are unreliable.

**Which lifts to track:**
- Squat, Bench Press, Deadlift (main lifts) — these have stable technique and respond well to e1RM tracking.
- Accessory lifts (rows, curls, etc.) — e1RM is not meaningful; track load/reps progression directly.

**App relevance:** `calculateE1RM` and `getTopSetE1RM` in `src/types/training.ts`. The `MAIN_LIFTS` constant (`['Squat', 'Bench Press', 'Deadlift']`) determines which exercises get e1RM display in the Active Workout screen and trend charts in the Progress tab.

---

## 3. Progressive Overload

The fundamental principle: to continue adapting, the training stimulus must increase over time. Adaptation stalls when the stimulus is constant.

**Three primary methods:**
1. **Load progression** — add weight to the bar (e.g. +2.5kg when hitting the top of a rep range).
2. **Volume progression** — add sets or reps (e.g. go from 3×5 to 4×5, or hit 5×5 before adding weight).
3. **Density progression** — do the same work in less time (shorter rest, more sets in same session duration).

**When to use each:**
- Beginners: linear load progression works every session. Add weight every session until it stalls.
- Intermediate: weekly progression. Increase load or reps week over week within a training block.
- Advanced: block-level progression. Accumulate volume at a given load over 3–4 weeks, then increase load next block.

**Double progression** (practical for accessories):
- Pick a rep range (e.g. 8–12 reps).
- Start at the bottom (8 reps). Add reps each session until hitting the top (12 reps). Then add load and drop back to 8 reps.

**Practical increments:**
- Lower body (squat, deadlift): 5kg jumps reasonable for intermediate; 2.5kg for advanced/near-peak.
- Upper body (bench, press): 2.5kg jumps.
- Accessories: whatever the equipment allows.

**App relevance:** The program prescriptions (`SetPrescription`) define target reps as a string (e.g., "5" or "8–12"). The app tracks actual performance via `SetLog`. Future features may automate progression suggestions based on whether the lifter hit the top of their rep range at a given RPE.

---

## 4. Fatigue & Recovery

### SRA Cycle (Stimulus → Recovery → Adaptation)
Training creates a stimulus that first causes fatigue (performance temporarily drops), then recovery, then adaptation (supercompensation — performance is higher than baseline). The next session should ideally be timed near peak adaptation.

- Too frequent: next session hits before full recovery → cumulative fatigue accumulates.
- Too infrequent: adaptation fades before the next session → no cumulative progress.
- Optimal frequency varies by exercise, volume, and the individual.

### Acute vs Cumulative Fatigue
- **Acute fatigue**: from a single session. Resolves within 24–72 hours for most lifters.
- **Cumulative (chronic) fatigue**: builds across weeks of training. Requires a deload to dissipate. Signs include: RPE drift (same load feeling harder), poor sleep, loss of motivation, joint aches, performance plateau or regression.

### Systemic vs Local Fatigue
- **Systemic fatigue** affects the whole body: CNS, sleep quality, mood, appetite, libido. Driven primarily by high-intensity compound work (especially deadlifts and squats).
- **Local/peripheral fatigue** is specific to trained muscles and recovers faster.

High systemic fatigue exercises: Deadlift > Squat > Bench Press > Accessories.

### Readiness Check-In Interpretation
The app collects sleep (4–10 hrs), energy (1–5), and soreness (1–5). Suggested interpretation:

| Signal | Low readiness indicator | Suggested adjustment |
|--------|------------------------|---------------------|
| Sleep  | <6 hrs | Reduce intensity 5–10%, consider cutting volume |
| Energy | ≤2/5 | Reduce total volume 20–30%, avoid PRs |
| Soreness | ≥4/5 in trained muscle | Delay training that muscle, or significantly reduce volume |

Note: the app collects sleep down to 4 hrs minimum — values of 4–5 hrs represent the extreme low end and should always trigger low-readiness flags.

These are guidelines, not hard rules. Experienced lifters often train through moderate fatigue — the SRA cycle partially depends on training under some fatigue to drive adaptation.

**App relevance:** `ReadinessCheckIn` type stores sleep/energy/soreness. Currently stored per session but not used to auto-adjust programming. Future features could use this data to flag fatigue trends or suggest deloads.

---

## 5. Volume Landmarks

Mike Israetel's volume landmark model is the dominant framework for evidence-based volume prescription:

| Landmark | Definition | Typical weekly sets (per muscle group) |
|----------|-----------|---------------------------------------|
| **MEV** (Minimum Effective Volume) | Minimum to make progress / maintain | 6–10 sets (lower-demand groups such as arms and glutes sit at the lower end; compound-dominant groups such as quads, chest, and back sit at the higher end) |
| **MAV** (Maximum Adaptive Volume) | Optimal range for most progress | 12–20 sets |
| **MRV** (Maximum Recoverable Volume) | Maximum before recovery is compromised | 20–30+ sets (highly individual) |

**Important caveats:**
- These are highly individual and depend on training age, sleep, nutrition, stress, and exercise selection.
- Lower-fatigue exercises (machines, cables) allow more sets than high-fatigue free weight compounds.
- Deadlift: MEV is lower than other movements (~3–4 sets/week) due to very high systemic fatigue.
- Volume should be built up progressively over months — jumping to MAV immediately causes MRV to be hit quickly.

**Counting sets:**
- Count working sets only (typically RPE ≥7 or within 3 reps of failure).
- Do not count warm-up sets.
- Main lifts count toward their primary muscle group(s). E.g., a Squat working set counts toward quads and glutes.

**Per muscle group rough MEV/MAV:**
- Quads: MEV ~8, MAV ~12–18
- Hamstrings: MEV ~6, MAV ~10–16
- Chest: MEV ~8, MAV ~12–20
- Back: MEV ~8, MAV ~14–22
- Shoulders: MEV ~6, MAV ~12–20
- Biceps/Triceps: MEV ~6, MAV ~10–16
- Glutes: MEV ~4, MAV ~8–16
- Core: MEV ~4, MAV ~8–12 (note: volume landmarks are not well-established for core; these are approximate)
- Posterior Chain: MEV ~4, MAV ~8–14 (encompasses hamstrings/glutes/erectors when trained as a unit; track individual muscles when possible)

**App relevance:** The Progress tab's Weekly Volume Dashboard tracks sets per muscle group. Color coding (grey/green/amber) is planned to map to below MEV / within MAV / approaching MRV respectively. (not yet implemented — this is the intended design) The `MuscleGroup` type in `training.ts` defines the tracked groups.

---

## 6. Periodization

### Block Periodization
The dominant approach in modern powerlifting. Training is divided into distinct blocks, each with a specific goal:

| Block | Duration | Volume | Intensity | Goal |
|-------|----------|--------|-----------|------|
| **Accumulation** | 4–6 weeks | High | Moderate (65–75% 1RM) | Build work capacity, volume |
| **Intensification** | 3–4 weeks | Moderate | High (75–85% 1RM) | Convert volume to strength |
| **Realization / Peaking** | 2–3 weeks | Low | Very high (85–95%+ 1RM) | Express strength, hit PRs |
| **Deload** | 1 week | Low | Low–moderate | Dissipate cumulative fatigue |

**Practical rules:**
- Volume and intensity are inversely related in each block: as intensity rises, volume must come down to remain recoverable.
- A realization block without a preceding accumulation + intensification cycle will underperform.
- Deloads are not optional for advanced lifters — they are where adaptation from the preceding block is consolidated.

### Deload Guidelines
- Reduce total volume 40–60% (cut sets, not exercises or load).
- Maintain or slightly reduce intensity (do not go very light — maintain movement patterns).
- Duration: 1 week is standard; 5–7 days is usually sufficient.
- Frequency of deloads: every 4–8 weeks depending on training age and volume.

### App's Sample Program Structure
The sample program uses `ProgramBlock` objects with `weekNumber` and `focus` fields. Each block maps to a phase:
- Blocks with focus containing "Conditioning" or high rep prescriptions → Accumulation phase.
- Blocks with focus containing "Strength" or lower rep ranges → Intensification/Realization phase.

This is an informal naming convention used in the sample data, not a type-level contract — the `focus` field is a free string with no enum constraint.

**App relevance:** `ProgramBlock`, `ProgramDay`, `ProgramExercise`, `SetPrescription` in `training.ts`. The current block index and day index are tracked in the `Program` type and updated via `updateProgramProgress`.

---

## 7. Rest Periods

Evidence-based rest period recommendations by training goal:

| Training goal | Rep range | Intensity | Rest period |
|---------------|-----------|-----------|-------------|
| Maximal strength | 1–5 reps | >85% 1RM | **3–5 minutes** |
| Strength-hypertrophy | 4–8 reps | 75–85% 1RM | **2–4 minutes** |
| Hypertrophy | 8–15 reps | 65–75% 1RM | **1.5–3 minutes** |
| Muscular endurance / accessories | 15+ reps | <65% 1RM | **1–2 minutes** |

**Key points:**
- Longer rest periods produce better strength outcomes for heavy compound work (more ATP-PCr recovery between sets).
- Shorter rest periods are acceptable for accessories and hypertrophy work where metabolic stress is the goal.
- After the Deadlift specifically, err toward the longer end — systemic fatigue recovery takes longer.
- The app default of 120 seconds (2 minutes) is appropriate for mixed/hypertrophy training but may be too short for heavy strength work. Consider offering a per-exercise or per-rep-range default.

**App relevance:** `restTimerDuration` in the Zustand store (default 120s). `RestTimer` component. Future improvement: set default rest time based on RPE or rep range of the completed set.

---

## 8. Main Lift Specifics

### Squat
- **Fatigue profile:** High systemic + high local (quads, glutes, spinal erectors). One of the most fatiguing exercises.
- **Recommended frequency:** 2–3x/week for most lifters. Advanced competitive lifters may squat 4x/week.
- **Recovery time:** 48–72 hours between heavy squat sessions.
- **Programming notes:** Squats should come first in a session when fresh. Paused squats, tempo squats, and SSB squats are useful variation tools but are more fatiguing than competition-style squats.
- **e1RM tracking:** Yes — stable technique and measurable across rep ranges.

### Bench Press
- **Fatigue profile:** Moderate systemic, high local (pecs, triceps, anterior deltoids). Recovers faster than squat or deadlift.
- **Recommended frequency:** 2–4x/week. High frequency bench (3–4x) is well-supported by evidence for intermediate and advanced lifters.
- **Recovery time:** 24–48 hours between heavy bench sessions.
- **Programming notes:** Shoulder health is the primary long-term concern. Wide-grip benching stresses the shoulders more. Close-grip, incline, and dumbbell variations are useful for volume without additional shoulder stress.
- **e1RM tracking:** Yes — most accurate e1RM estimate due to relatively consistent technique across lifters.

### Deadlift
- **Fatigue profile:** Highest systemic fatigue of any exercise. Very high local (posterior chain, spinal erectors, grip). Full recovery from a heavy deadlift session: 72–96+ hours.
- **Recommended frequency:** 1–2x/week for most lifters. Weekly deadlift frequency of 1 is sufficient for most intermediate lifters when using accessory pulls (RDL, deficit deadlift).
- **Recovery time:** 72–96 hours minimum after heavy/high-volume deadlift work.
- **Programming notes:** Deadlifts should almost always be done last in a session (or in their own session) to avoid compromising performance on squats and bench. Romanian deadlifts (RDLs) and deficit deadlifts are more fatiguing than conventional at the same load — handle volume carefully.
- **e1RM tracking:** Yes — but less consistent than squat/bench due to grip fatigue, hip hinge variance, and conventional vs sumo technique differences.

---

## Appendix: Quick Reference for App Feature Decisions

| Feature/decision | Principle to apply |
|-----------------|-------------------|
| Rest timer default | 120s is fine for hypertrophy; 180–300s for strength work |
| When to show e1RM | Only for Squat, Bench Press, Deadlift |
| Fatigue flag threshold | e1RM drop over 2+ consecutive sessions |
| Volume dashboard colour coding | Grey = below MEV, Green = MEV–MAV range, Amber = approaching MRV |
| Readiness check-in low energy threshold | Energy ≤2 or Sleep <6hrs = flagged as low readiness |
| Deload suggestion trigger | Cumulative fatigue signals: RPE drift, 3+ sessions of e1RM decline |
| Set counting for volume | Count RPE ≥7 working sets only, not warm-ups |
