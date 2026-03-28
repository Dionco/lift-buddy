# Powerlifting Expert Agent — Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Overview

A two-part system providing powerlifting domain expertise throughout the development of lift-buddy, with a foundation designed to support a personal in-app coaching feature later.

**Part 1 (now):** Development-time expert — a knowledge base document and a Claude Code skill for consulting during app development.

**Part 2 (later):** In-app coaching feature — the knowledge base becomes the system prompt for a Claude API integration that reviews the user's training data and gives personalised feedback.

---

## Part 1: Development-Time Expert

### 1a. Knowledge Base Document

**File:** `docs/powerlifting-knowledge.md`

A structured, comprehensive reference covering evidence-based powerlifting principles. Written as a dual-purpose document: background context for Claude Code during development, and foundation for the in-app system prompt later.

**Sections:**

1. **RPE & RIR** — How RPE 6–10 maps to reps in reserve, subjectivity and calibration, interaction with fatigue, why RPE drifts when cumulative fatigue is high
2. **e1RM** — The Epley formula used in the app (`weight / (1.0278 - 0.0278 × effectiveReps)`), accuracy at different rep ranges, why it's most reliable at 1–5 reps, which lifts warrant e1RM tracking
3. **Progressive Overload** — Load, volume, and density progression; criteria for adding weight vs reps vs sets; micro vs macro progression cycles
4. **Fatigue & Recovery** — Acute vs cumulative fatigue, SRA (Stimulus–Recovery–Adaptation) cycle, systemic vs local fatigue, how readiness indicators (sleep, energy, soreness) map to training readiness
5. **Volume Landmarks** — MEV (Minimum Effective Volume), MAV (Maximum Adaptive Volume), MRV (Maximum Recoverable Volume) per muscle group; how to interpret weekly set counts
6. **Periodization** — Block periodization (accumulation → intensification → realization), how the app's sample program structure maps to these phases, when to deload
7. **Rest Periods** — Evidence-based defaults by intensity range: strength work (≥85% 1RM / low reps) 3–5 min, hypertrophy (65–85% / moderate reps) 1.5–3 min, accessory/higher rep work 1–2 min
8. **Main Lift Specifics** — Squat, Bench Press, Deadlift: fatigue profiles, recommended frequency, recovery demands relative to accessories

**CLAUDE.md integration:** A reference added to `CLAUDE.md` pointing to this file so it is loaded as background context every session.

### 1b. Claude Code Skill

**File:** `.claude/skills/plift.md`
**Invocation:** `/plift <question or context>`

A project-scoped skill that loads a powerlifting expert persona for focused consultations during development. Instructs the agent to:
- Act as an evidence-based powerlifting coach familiar with the lift-buddy codebase and data model
- Reference `docs/powerlifting-knowledge.md` as its knowledge foundation
- Keep responses actionable and specific to what is being built — not generic coaching advice

**Example usage:**
- `/plift does this fatigue scoring logic make sense?`
- `/plift what should the default rest timer be for heavy triples?`
- `/plift review the weekly volume calculation in ProgressTab`

---

## Part 2: In-App Coaching Feature (Future Scope)

Out of scope for current development. Defined here to ensure Part 1 is built with the right foundation.

**What it is:** A Claude API call triggered manually by the user (e.g. "Get Feedback" button on Progress or History tab). The expert reviews the user's actual session and progress data and returns personalised tips and comments.

**How Part 1 connects:**
- `docs/powerlifting-knowledge.md` becomes the core of the system prompt
- The API call includes structured session context: recent e1RM trend, weekly volume per muscle group, readiness scores, average RPE per session
- The response is displayed in-app as coach commentary

**Not designed now:** UI, API integration, data formatting, prompt engineering for the in-app feature. These get their own spec when the time comes.

---

## Deliverables

| Deliverable | Path | Notes |
|---|---|---|
| Knowledge base | `docs/powerlifting-knowledge.md` | Primary artifact |
| Claude Code skill | `.claude/skills/plift.md` | Project-scoped |
| CLAUDE.md update | `CLAUDE.md` | Add reference to knowledge base |
