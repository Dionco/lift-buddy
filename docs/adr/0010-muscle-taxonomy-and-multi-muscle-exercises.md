# 0010 — Muscle taxonomy is per-muscle and exercises tag multiple primary muscles

## Status
Accepted — 2026-05-05

## Context
The original `MuscleGroup` union had ten composite values (Quads, Glutes, Chest, Triceps, Back, Hamstrings, Shoulders, Biceps, Core, Posterior Chain) and each `Exercise` carried a single `muscleGroup` field. Two limitations followed.

1. **Granularity too coarse for evidence-based programming.** A Lateral Raise and an Overhead Press both tagged `Shoulders`, but the three deltoid heads have very different MEV/MAV/MRV recoverability profiles. `Back` flattened lats vs. mid-back. `Posterior Chain` hid which muscles a deadlift actually drove.

2. **Compounds counted once, contradicting the documented domain rule.** `CONTEXT.md` and `docs/powerlifting-knowledge.md` both stated that compound lifts should contribute to multiple muscle groups (a Squat working set toward both Quads and Glutes); the seam existed in `volume.ts` (`contributesTo`) but the default credited only one muscle, so the Progress tab understated weekly volume across every compound.

## Decision
- Replace the `MuscleGroup` union with a 17-muscle, per-muscle taxonomy: Quads, Hamstrings, Glutes, Adductors, Calves, Spinal Erectors, Chest, Front Delts, Side Delts, Triceps, Lats, Upper Back, Traps, Rear Delts, Biceps, Forearms, Core. `Shoulders`, `Back`, and `Posterior Chain` are removed; their recovery profiles diverge enough across constituents that aggregating obscures programming decisions.
- Replace `Exercise.muscleGroup: MuscleGroup` with `Exercise.primaryMuscles: MuscleGroup[]` and an optional `Exercise.secondaryMuscles?: MuscleGroup[]`. Ordering of the primary list reflects emphasis.
- **Volume math counts primaries only.** Each working set credits +1 to every primary muscle. Secondaries are display-only on the Exercise; they do not count toward MEV/MAV/MRV bands. This matches Israetel's published "primary muscle group(s)" rule and keeps the band thresholds calibrated against direct stimulus.
- The `contributesTo` callback on `computeWeeklyVolume` becomes an override (tests, future per-user tweaks); its default is the exercise's `primaryMuscles`.

## Tagging discipline
- **Compound primary tagging** follows the muscles that receive a stretch-mediated hypertrophy stimulus — not isometric stabilisers. Concretely:
  - Deadlift's Lats / Upper Back / Traps stay **secondary**: they hold the bar isometrically; an isometric hold is not a hypertrophy stimulus, and crediting them would inflate back volume and starve direct lat work.
  - Pull-up & Row biceps stay **secondary**: keeps the biceps weekly bar reflecting direct curl/biceps work the lifter actually controls. Conservative stance — revisit if biceps consistently sit below MEV in real training data.
  - Overhead Press: front delts and triceps are primary; **Side Delts are secondary** because the press is front-delt dominant and crediting side delts here causes under-prescription of direct lateral work, which is the most common Israetel-flagged programming error.
  - Sumo Deadlift: **Adductors are primary** — the stance signature; what biomechanically distinguishes sumo from conventional. Hamstrings drop to secondary (sumo is more hip-dominant than hamstring-dominant).

## Migration
Bumped Zustand persist version `1 → 2`. The migration walks every `Exercise` reachable from `state.sessions`, `state.activeSession`, and `state.program.blocks[].weeks[].days[].exercises[]`, rewriting the shape in place. Known seed-exercise ids resolve to their canonical `primaryMuscles`/`secondaryMuscles`; unknown ids fall back to a legacy-string-to-array map (`Posterior Chain → [Glutes, Hamstrings, Spinal Erectors]`, `Shoulders → [Front Delts, Side Delts]`, `Back → [Lats, Upper Back]`, etc).

## Consequences

**Positive**
- Per-muscle MEV/MAV/MRV bands now reflect actual programming reality (front/side/rear delts are independent, posterior-chain muscles have their own bars).
- Compound lifts produce the volume signature the domain has always claimed they should — a single Squat session moves both Quads and Glutes bars, not just one.
- The schema accommodates fractional secondary credit later without another breaking change: secondaries are already a structured field; only the math has to opt in.

**Trade-offs**
- The Progress tab's volume section grows from ~10 rows to up to 17. Mitigated by region-grouping (Lower / Push / Pull / Core) and collapsing untrained muscles whose `MEV === 0` into a footer.
- The persisted-data migration is one-way; rolling back to v1 is not supported. Users on the previous schema will see their exercises re-tagged on next load.

**Out of scope**
- Custom exercise creation UI (no UI exists yet; tagging would be added with that feature).
- Fractional secondary credit (e.g. 0.5 sets toward secondaries). Field exists; math doesn't.
- Per-lifter MEV/MAV/MRV personalisation; landmarks remain a single static table in `volume.ts`.
- Stance-specific landmarks (e.g. sumo vs conventional erector load); handled by per-exercise primary tagging, not by the landmark table.
