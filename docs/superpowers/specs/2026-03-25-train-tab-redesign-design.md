# Train Tab Redesign — Design Spec

**Date:** 2026-03-25
**Status:** Approved

---

## Overview

Replace the current Train tab (three generic list-item cards) with a focused, information-rich layout centred on the upcoming session. Inspired by the reference app (Hevy-style), the redesigned tab prioritises getting the user into their programmed session with full context in one glance.

---

## Layout

Two elements, top to bottom, inside the existing `p-5 pb-24` scroll container:

1. **Session card** — the primary element; shows today's programmed session
2. **Start Empty Workout button** — full-width outline button directly below the card

The "Train" heading (`h1`) stays at the top as-is. No other elements.

---

## Session Card

A single rounded bordered card (`rounded-xl border border-border bg-card shadow-sm`).

### Header row

Two columns, space-between, inside the card:

- **Left:** Program name rendered as a tappable text link with a small external-link icon (`ExternalLink` from lucide-react). Tapping calls `onViewProgram`. Style: `text-sm font-medium text-primary`.
- **Right:** Muted week/day label — `Week {n} · {dayName}` — in `text-sm text-muted-foreground`.

### Exercise table

Rendered below a thin divider line inside the card.

**Column headers** (small, muted):

| Exercise | Sets | Reps | RPE |
|----------|------|------|-----|

**Exercise rows** — one per `currentDay.exercises`:

- **Exercise:** `exercise.name` in `text-sm font-medium text-foreground`
- **Sets:** `prescription.sets` (number)
- **Reps:** `prescription.reps` (string, e.g. `"5"`, `"8-12"`)
- **RPE:** `prescription.rpeTarget` formatted as a number (e.g. `8`, `7.5`), or `—` if undefined

Light horizontal dividers between rows (`divide-y divide-border`).

### CTA button

Full-width, inside the card at the bottom, separated by a thin divider:

- Style: `bg-primary text-primary-foreground rounded-lg w-full`
- Label: `Start Week {n} · {dayName}`
- Action: existing `handleStartToday` logic (unchanged)

---

## Start Empty Workout Button

Below the card, full-width outline button:

- Style: `variant="outline"` (shadcn Button) or equivalent `border border-border rounded-xl`
- Label: `Start Empty Workout`
- Action: existing `onStartEmpty` (unchanged)

---

## Data Sources

All data comes from existing store state — no new store fields required:

- `program.name` — program name in card header
- `currentBlock.weekNumber` — week number
- `currentDay.name` — day name
- `currentDay.exercises` — array of `ProgramExercise` for the table rows
- `pe.exercise.name`, `pe.prescription.sets`, `pe.prescription.reps`, `pe.prescription.rpeTarget` — table cell values

---

## What Is Removed

- "Today's Session" card (replaced by the new session card)
- "View Program" standalone card (replaced by tappable program name in card header)

---

## Constraints

- Light mode only; no dark mode variants needed
- 44px+ touch targets on the CTA and empty workout button
- No new dependencies; uses existing shadcn/ui primitives and lucide-react icons
- No new store state or data model changes
