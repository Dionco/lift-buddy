# Train Tab Redesign — Design Spec

**Date:** 2026-03-25
**Status:** Approved

---

## Overview

Replace the current Train tab (three generic list-item cards) with a focused layout centred on the upcoming session. The redesigned tab prioritises getting the user into their programmed session with full context in one glance.

---

## Layout

Outer container: existing `flex flex-col gap-4 p-5 pb-24`. Three elements, top to bottom:

1. `h1` heading — "Train" (unchanged)
2. **Session card** — renders only when both `currentBlock` and `currentDay` are defined (see No-Program State)
3. **Start Empty Workout button** — always present

The `gap-4` spacing is preserved between all elements.

---

## No-Program State

When `currentBlock` or `currentDay` is undefined, the session card is not rendered. Only the "Train" heading and the Start Empty Workout button appear. No placeholder text or empty-state illustration.

---

## Session Card

Guard: `{currentBlock && currentDay && <SessionCard />}` — use both to satisfy TypeScript's type narrower.

Card: `rounded-xl border border-border bg-card shadow-sm p-4`

If `currentDay.exercises` is an empty array, the card still renders (empty table body, CTA still functional). No fallback message.

### Header Row

`flex items-center justify-between gap-2`

**Left — program name link** (`flex items-center gap-0.5 flex-1 min-w-0 min-h-[44px]`):
- Element: `<button type="button">` — not `<a>` or `<div>`, ensures keyboard/focus behaviour
- Renders `program.name` (e.g. `"4-Week Powerlifting Block"`)
- `onClick` calls `onViewProgram`
- Text: `text-sm font-medium text-primary truncate`
- Icon: `ChevronRight` from lucide-react (`h-4 w-4 flex-shrink-0 text-primary`)
- Use `flex` (not `inline-flex`) so `flex-1` participates correctly in the parent layout

**Right — week/day label** (`flex-shrink-0`):
- Text: `` `Week ${currentBlock.weekNumber} · ${currentDay.name}` ``
- `currentBlock.weekNumber` is type `number`; `currentDay.name` is type `string`
- Style: `text-sm text-muted-foreground`
- Never truncated; program name truncates first when space is tight

---

### Divider

`<div className="border-t border-border my-3" />` between header and exercise table.

---

### Exercise Table

Two sibling `<div>` groups (not `<table>`):

**Column header row** (`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-xs text-muted-foreground pb-1`):

Four cells, one per column, each aligned over its data column:
- `Exercise` — `text-left`
- `Sets` — `text-center w-10`
- `Reps` — `text-center w-10`
- `RPE` — `text-center w-10`

**Data rows container** (`divide-y divide-border`):

Each row maps over `currentDay.exercises` (type `ProgramExercise[]`):

`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 py-2 items-center`

| Column | Source | Style |
|--------|--------|-------|
| Exercise | `pe.exercise.name` (string) | `text-sm font-medium text-foreground text-left` |
| Sets | `pe.prescription.sets` (number) | `text-sm text-foreground text-center w-10` |
| Reps | `pe.prescription.reps` (string) | `text-sm text-foreground text-center w-10` |
| RPE | `pe.prescription.rpeTarget` (number \| undefined) → render as-is or `—` | `text-sm text-foreground text-center w-10` |

RPE decimals rendered as-is (e.g. `7.5`, `8`). No max height; the outer scroll container handles overflow.

---

### CTA Button

`<div className="border-t border-border mt-3 pt-3">`

- Style: `bg-primary text-primary-foreground rounded-lg w-full min-h-[52px] font-semibold whitespace-normal text-center active:scale-[0.98] transition-transform`
- Label: `` `Start Week ${currentBlock.weekNumber} · ${currentDay.name}` ``
- Label is allowed to wrap on narrow screens
- Action: calls `handleStartToday`, which is a local wrapper that builds the `ExerciseLog[]` array from `currentDay.exercises` and calls `onStartToday(exercises, name, currentDay.id)` where `name` = `` `Week ${currentBlock.weekNumber} · ${currentDay.name}` ``. This function is identical to the existing implementation — do not change its logic.

---

## Start Empty Workout Button

Spacing from session card handled by parent `gap-4`.

- Style: `w-full rounded-xl border border-border bg-background min-h-[52px] text-sm font-medium text-foreground active:scale-[0.98] transition-transform`
- Label: `Start Empty Workout`
- Action: existing `onStartEmpty` (unchanged)

---

## Data Sources

All from existing store state — no new store fields required:

| Token | Type | Source |
|-------|------|--------|
| Program name | `string` | `program.name` |
| Week number | `number` | `currentBlock.weekNumber` |
| Day name | `string` | `currentDay.name` |
| Exercises | `ProgramExercise[]` | `currentDay.exercises` |
| Exercise name | `string` | `pe.exercise.name` |
| Sets | `number` | `pe.prescription.sets` |
| Reps | `string` | `pe.prescription.reps` |
| RPE target | `number \| undefined` | `pe.prescription.rpeTarget` |
| Day ID | `string` | `currentDay.id` (used in `onStartToday` call) |

---

## What Is Removed

- "Today's Session" card (replaced by the new session card)
- "View Program" standalone card (replaced by tappable `program.name` in card header)
- "Start Empty Workout" card (replaced by the outline button below)
- Icon imports `Play`, `Zap`, `BookOpen` — no longer used; remove from import statement
- New import needed: `ChevronRight` from `lucide-react`

---

## Constraints

- Light mode only; no dark mode variants
- 44px+ touch targets: CTA (`min-h-[52px]`), empty workout button (`min-h-[52px]`), program name link (`min-h-[44px]` via `flex` wrapper)
- No new dependencies; no new store state or data model changes
