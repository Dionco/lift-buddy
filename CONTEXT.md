# Lift Buddy

A powerlifting training tracker. The app prescribes training (programs) and records what the lifter actually did (sessions), so progress on the main lifts can be measured over time.

## Language

### Programming

**Program**:
A complete training plan a lifter is following — a sequence of **Blocks** with overall focus and structure. A lifter has at most one **Active Program** at a time.
_Avoid_: routine, plan

**Active Program**:
The single Program currently driving the lifter's training. Its progression cursor (current Block / Week / Day) determines what the **Train** tab proposes next. Switching to a different Program ends the previous one's active state.
_Avoid_: current program (when ambiguous with "the program you're viewing")

**Block**:
A multi-week training phase with a single focus (e.g. Accumulation, Intensification, Peaking, Deload). Spans multiple **Weeks**.
_Avoid_: phase, mesocycle (treat as alias)

**Week**:
One week of training within a **Block**. Contains multiple **Days**. Lifters progress block-by-block, week-by-week.
_Avoid_: microcycle (treat as alias)

**Day**:
A single planned training **Workout** within a **Week** — a list of **Program Exercises** with their **Prescriptions**.
_Avoid_: training day (when it would be ambiguous with date)

**Prescription**:
What the program asks the lifter to do for one exercise: number of sets, reps, and an optional **RPE** target.
_Avoid_: target, plan

### Doing the work

**Session**:
A record of what the lifter actually did in one workout — logged sets, **Readiness** check-in, and any notes. Optionally tied to a programmed **Day** via `programDayId`. A Session describes reality; it does not enforce the program.
_Avoid_: workout (when referring to logged data — see ambiguity below)

**Ad-Hoc Session**:
A Session with no `programDayId` — the lifter trained outside the program (e.g. travel, curiosity, no active program). Fully supported; counts for e1RM and history.
_Avoid_: free workout

**Prescribed-but-Skipped Exercise**:
An exercise present on the Day's prescription but absent from the Session's `exercises[]`. The Session Summary surfaces these by diffing the Session against the Day. We do not fabricate "missed" sets — absence means it didn't happen.

**Bonus Exercise**:
An `ExerciseLog` on a Session for an exercise that wasn't in the Day's prescription (e.g. the lifter added curls). Stored normally; flagged as "not prescribed" in the Session Summary. Counts for e1RM and volume.

**Set**:
A single set the lifter performed: weight (always in **kg**), **actual** reps achieved, and **RPE**. `completed: true` means "logged and counted"; `reps` is always what the lifter actually did, never the prescription target.
_Avoid_: rep set

**Missed Reps**:
When the lifter attempted the prescribed reps but fell short. Stored as a normal **Set** with `reps` set to what was actually achieved (e.g. prescribed 3, got 2 → `reps: 2, completed: true`). "Missed" is a derived view from comparing the Set against the corresponding **Prescription**, not a stored flag. Skipped sets are represented by absence from the Session's set list, not by a flag.
_Avoid_: failed set

**Top Set**:
The set (or sets) within an exercise performed at the highest load or highest level of effort. Operationalized as the completed set with the highest **e1RM** — a robust proxy for "highest effort" across rep ranges. Computed for every exercise.
_Avoid_: heaviest set (ambiguous — top set can be lighter than back-off sets if reps/effort are higher)

**Straight Sets**:
A collection of sets with uniform weight and reps (e.g. 5×5 at 100kg). Distinct from a top-set + back-off scheme.
_Avoid_: regular sets

**Working Sets** (= **Back-Off Sets**):
The sets following a **Top Set**, performed at a reduced load (typically same rep range), where most of the workout's volume is accumulated. The two terms are synonymous in this app.
_Avoid_: assistance sets, secondary sets

**Warmup Set**:
A set performed below working intensity to prepare for the **Top Set** or **Working Sets**. Not logged for **e1RM**.
_Avoid_: ramp set

**Readiness**:
A pre-session self-report of sleep (hours), energy (1–5), and soreness (1–5). Optional context for interpreting performance, not a gate that blocks training.
_Avoid_: check-in, status

### Lifting

**Main Lift**:
One of the three competition powerlifts: Squat, Bench Press, Deadlift. Surfaced more prominently in Progress views since they're what the lifter trains for, but **e1RM** is tracked for every exercise (see Accessory). **Variations** of a Main Lift (e.g. Paused Squat) are *not* Main Lifts — they are separate Exercises in their own right.
_Avoid_: big three, primary lift

**Variation**:
A distinct movement that shares mechanics with a parent lift but isn't the same exercise — e.g. **Paused Squat**, **Tempo Squat**, **SSB Squat**, **Close-Grip Bench**, **Paused Bench**, **Sumo Deadlift**, **Deficit Deadlift**, **RDL**. Each Variation is its own `Exercise` row with its own e1RM history and PRs. A Variation may carry a soft `relatedTo` tag pointing at its parent Main Lift for grouping in UI, but they are never aggregated for progress tracking.
_Avoid_: variant, version

**Accessory**:
Any exercise that is not a **Main Lift**. Accessories build muscle, address weak points, or supplement the Main Lifts. **e1RM** is computed for accessories too, so the lifter can verify progressive overload on every exercise — not just the competition lifts.
_Avoid_: assistance lift, secondary

**RPE** (Rate of Perceived Exertion):
A 1–10 self-rated scale of set difficulty. RPE 10 = no reps left in reserve; RPE 8 = two reps left. The canonical autoregulation tool.
_Avoid_: effort rating

**e1RM** (Estimated 1-Rep Max):
A predicted one-rep-max derived from a non-maximal set's weight, reps, and RPE. Calculated as `weight / (1.0278 - 0.0278 × (reps + (10 - rpe)))`. Computed for **every** exercise. Most accurate at 1–5 reps; error grows above 10 reps. Cross-rep-range comparisons (e.g. a 3-rep e1RM vs a 10-rep e1RM) are not reliable — only compare e1RM within similar rep ranges.
_Avoid_: 1RM (which means an actual tested max)

### Progress

**Progress Signal**:
The canonical answer to "is the lifter getting stronger on this exercise?" Differs by exercise type:
- **Main Lifts**: positive slope of top-set **e1RM** within a comparable rep range (e.g. all 3–5-rep top sets) over the trailing window (default: 4 weeks or last 6 sessions, whichever is more).
- **Accessories**: **Double Progression** — did the lifter add reps within the prescribed rep range, or add load after hitting the top of the range, since the last session for this exercise?

_Avoid_: progress (when ambiguous with general progression talk)

**Double Progression**:
The standard accessory progress rule: pick a rep range (e.g. 8–12). Each session, add reps until hitting the top of the range. Once you hit the top reps for all prescribed sets at the target RPE, add load and drop back to the bottom of the range. The progress signal for accessories.

**Personal Record (PR)**:
A new all-time-high top-set **e1RM** for an exercise (any rep range). Celebratory; surfaced in the Session Summary as a flourish. Independent of the **Progress Signal** — a PR is a moment, the slope is a trend. Tracked for every exercise but rep-range caveats apply (a 10-rep PR and a 3-rep PR are different milestones).

**Volume**:
Sum of working sets per muscle group per week, where a working set is `RPE ≥ 7` (warmups excluded). Not the canonical progress signal — instead, a recoverability metric measured against **MEV / MAV / MRV** landmarks per muscle group. Compound lifts contribute to multiple muscle groups (a Squat working set counts toward both Quads and Glutes).

**MEV / MAV / MRV** (Volume Landmarks):
Per muscle group thresholds, per Mike Israetel:
- **MEV** (Minimum Effective Volume): minimum weekly working sets to make progress
- **MAV** (Maximum Adaptive Volume): the optimal range for most progress
- **MRV** (Maximum Recoverable Volume): the ceiling beyond which recovery is compromised

Drives the Progress tab's per-muscle-group color coding (grey = below MEV, green = MEV–MAV, amber = approaching MRV). Numeric ranges per muscle group live in `docs/powerlifting-knowledge.md`, not in the type system.

**Fatigue Signal**:
Evidence the lifter is accumulating chronic fatigue and may need a deload. Operational rule: top-set e1RM declines on a Main Lift across **3+ consecutive sessions** (in a comparable rep range), or RPE drift on the same load/reps. Triggers a deload suggestion, not an automatic action — the lifter decides.
_Avoid_: tired, burnout

## Relationships

- A lifter has at most one **Active Program** at a time
- A **Program** contains one or more **Blocks**
- A **Block** contains one or more **Weeks**, all sharing the Block's focus
- A **Week** contains one or more **Days**
- A **Day** prescribes one or more **Program Exercises**, each with a **Prescription**
- A **Session** records execution of (usually) one **Day**, containing multiple logged **Sets** per exercise
- Multiple **Sessions** may reference the same **Day** (e.g. lifter abandoned and restarted); only one needs to be marked complete for cursor advancement
- The **Active Program** cursor advances by explicit lifter action on the Session Summary, never silently from session-end
- A **Set** belongs to a **Session** and references an exercise; **e1RM** is computed for every exercise's top set, with Main Lifts surfaced more prominently in Progress views
- **Progress Signal** for Main Lifts is e1RM slope within a rep range; for Accessories it is **Double Progression**
- **Volume** is computed across Sessions per week, per muscle group, against **MEV/MAV/MRV** landmarks
- A **Fatigue Signal** is derived from declining e1RM trend on Main Lifts; it suggests a deload but never auto-triggers one
- A **Readiness** check-in attaches to at most one **Session**

## Example dialogue

> **Dev:** "If a lifter skips Day 2 and goes straight to Day 3, do we still create a Session for Day 2?"
> **Domain expert:** "No. A **Session** only exists if the lifter actually trained. The **Program** advances by what was completed, not by calendar days."

> **Dev:** "What's the **Top Set** if the lifter did 5×5 at the same weight and RPE?"
> **Domain expert:** "That's **Straight Sets** — there's no distinct top set. Any of them produces the same **e1RM**, so pick the first for stability."

> **Dev:** "Lifter did 1×3 @ 180kg RPE 9, then 3×5 @ 150kg RPE 8. What's the top set?"
> **Domain expert:** "The 3 @ 180. The 3×5 are the **Working Sets** (also called **Back-Off Sets**) — they hold the volume but they're not the top."

> **Dev:** "Should low **Readiness** stop the lifter from starting?"
> **Domain expert:** "No — it's just context. The lifter decides. We surface it on the **Session Summary** afterward to help interpret a bad day."

> **Dev:** "Lifter just finished the last **Day** of the last **Week** of an Accumulation **Block**. What happens?"
> **Domain expert:** "We prompt them — advance to the next Block, repeat this one, insert a deload, or jump ahead. We never auto-advance silently; the boundary between Blocks is where lifters most often want to deviate from the plan."

> **Dev:** "Day 3 prescribes squat, RDL, leg curl. The lifter's back is sore — they swap squat for leg press and add some curls. What does the **Session** look like?"
> **Domain expert:** "Three logged exercises: leg press, RDL, leg curl, plus the curls as a **Bonus Exercise**. Squat is a **Prescribed-but-Skipped Exercise** — the Summary shows it as 'prescribed but not done', but we don't store any fake squat sets. The Session is reality, not the prescription."

> **Dev:** "Lifter starts Day 4, bombs the warmup, walks out. Comes back two hours later, retries from scratch. Two Sessions or one?"
> **Domain expert:** "Two. Both reference Day 4. The first is flagged incomplete; the second the lifter marks as the one that 'counts' on the Summary. The cursor advances based on that explicit choice."

> **Dev:** "Prescription says 3×3. Set 1 they got 3, set 2 they got 3, set 3 they grinded out 2 and racked it. How is set 3 stored?"
> **Domain expert:** "`weight: <whatever>, reps: 2, rpe: 10, completed: true`. The 'missed rep' is derived by comparing against the **Prescription** — the **Set** itself just records what happened."

> **Dev:** "Lifter's bench top-set e1RM went from 122 to 125 over 4 weeks. Squat top-set e1RM went from 180 to 182. Curl top set went from 17.5kg×10 to 17.5kg×12. Are they all 'progressing'?"
> **Domain expert:** "Bench and Squat: yes — positive slope on the **Progress Signal** for **Main Lifts**. Curl: yes too, but for a different reason — they added reps in the same range at the same load, which is **Double Progression**. Don't try to compute curl e1RM trend; rep-range curls are too noisy for that to mean anything."

> **Dev:** "Lifter does competition Squat on Day 1 and Paused Squat on Day 3. Do those go on the same Squat trend chart?"
> **Domain expert:** "No. They're separate **Exercises** with separate e1RM histories. Paused Squat is a **Variation** — a paused squat e1RM is meaningfully lower than a competition squat e1RM, so combining them would corrupt the trend. The Squat chart shows competition Squat only; Paused Squat gets its own chart."

## Conventions

- **Units**: All weights are kilograms. The unit is not stored on Sets, Prescriptions, or anywhere else — it's a global invariant. See ADR-0007.

## Flagged ambiguities

- **"Workout" vs "Session"**: The codebase uses `WorkoutSheet`, `ActiveWorkout`, and `workoutName` interchangeably with the concept of a Session. Resolution: a planned **Day** is a "workout" colloquially, but the recorded execution is always a **Session**. Prefer **Session** in new code; existing component names can stay.
- **"Block" used to mean one week**: The original data model treated a Block as a single week (`weekNumber: number`). Resolution: **Block** is now a multi-week phase; **Week** is the within-block unit. See ADR-0001.
