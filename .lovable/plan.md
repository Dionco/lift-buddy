

# Powerlifting Training Tracker App

## Overview
A mobile-first powerlifting training tracker designed for one-handed gym use. Clean, minimal light UI with large tap targets and typography-forward design.

## Navigation
Bottom tab bar with 3 tabs: **Train**, **Progress**, **History**

---

## Train Tab (Home)
- Three large tappable cards: **Start Empty Workout**, **Today's Session** (shows current program day info), **View Program**
- Today's Session card displays current block/week/day context (e.g. "Week 3 · Day 2 — Strength: Squat & Accessories")

### Program Overview Screen
- Vertical timeline of program blocks as cards (e.g. "Week 1: Muscular Conditioning")
- Current week highlighted with accent color
- Tap to expand: shows training days, exercises, and set/rep targets

### Pre-Workout Readiness Check-in
- Triggered on session start (skippable)
- Three slider/stepper inputs: Sleep (4–10 hrs), Energy (1–5), Soreness (1–5)
- Stored per session

### Active Workout Screen
- Exercise name + muscle group tag header
- Set rows with large inputs: weight (kg), reps, RPE (6–10, 0.5 steps)
- Auto-starting rest timer (floating dismissible banner) after logging a set
- e1RM display after completing all sets of Squat, Bench, or Deadlift (formula: weight / (1.0278 - 0.0278 × effective_reps))
- Add/remove set buttons per exercise
- Swipe/scroll between exercises
- Finish Workout button

### Session Summary Screen
- Total sets, session duration, average RPE
- Top set e1RM per main lift (if trained)
- Free-text session note input

---

## Progress Tab
### e1RM Trends
- Line charts for Squat, Bench, Deadlift (date vs e1RM in kg)
- Fatigue flag: subtle red indicator when e1RM drops 2+ consecutive sessions

### Weekly Volume Dashboard
- Week selector (Mon–Sun)
- Sets per muscle group with target ranges and color coding (grey/green/amber)
- Total kg lifted this week
- Average RPE per session as day-by-day mini bars

---

## History Tab
- Scrollable list of past sessions (newest first)
- Cards show: date, workout name/block, total sets, duration, avg RPE
- Tap to expand full session log with all exercises and sets

---

## Data Model (Local State)
- **Exercises**: name, primary muscle group
- **Sets**: weight, reps, RPE, timestamp
- **Sessions**: start/end time, readiness values, optional note, exercises/sets
- **Program**: blocks → days → exercises → set prescriptions
- Seed with a sample powerlifting program for demo

## Design
- Light mode only, clean minimal aesthetic
- 44px+ touch targets, generous padding, subtle card shadows
- Simple sans-serif font (Inter), typography-forward with breathing room
- Floating dismissible rest timer banner
- Recharts for progress charts

