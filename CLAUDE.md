# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

Run a single test file:
```bash
npx vitest run src/test/example.test.ts
```

## Architecture

**Single-page app** — all routing happens client-side via a `screen` state machine in `src/pages/Index.tsx`. There is only one real route (`/`). The `screen` state (`tabs | program | readiness | workout | summary`) controls which full-screen view renders; the bottom tab bar (`train | progress | history`) is only visible in the `tabs` screen.

**State** — `src/store/useTrainingStore.ts` is the single Zustand store (persisted to localStorage as `training-store`). All workout mutations go through this store. Seeded with sample data from `src/data/` on first load.

**Types** — `src/types/training.ts` defines all domain types and the e1RM formula. Main lifts (Squat, Bench Press, Deadlift) get e1RM calculation; other exercises don't.

**Components** — flat under `src/components/`. Each major screen has its own component (`ActiveWorkout`, `ReadinessCheck`, `SessionSummary`, `ProgramOverview`, `TrainTab`, `ProgressTab`, `HistoryTab`). `src/components/ui/` is shadcn/ui — don't modify these.

**Path alias** — `@/` maps to `src/`.

## Design constraints

- Light mode only — no dark mode support.
- Mobile-first, one-handed use: 44px+ touch targets, generous padding.
- Recharts for all charts (already a dependency).
- Dexie is installed but unused — persistence is handled by Zustand's `persist` middleware.

## Domain Knowledge

This app is a powerlifting training tracker. Before making decisions about training logic, feature behaviour, or data model design, read:

**`docs/powerlifting-knowledge.md`** — Evidence-based powerlifting principles covering RPE, e1RM, progressive overload, fatigue, volume, periodization, rest periods, and the main lifts (Squat, Bench Press, Deadlift).

For focused domain consultations during development, use the `/plift` skill.

## Agent skills

### Issue tracker

GitHub Issues at `Dionco/lift-buddy`, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles using default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
