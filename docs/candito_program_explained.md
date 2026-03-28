# Candito 6-Week Program - Structure & Components Explained

## Overview

This is the **Candito 6-Week Intermediate + Advanced Bench Program Combined** - a powerlifting program designed to peak all three competition lifts (Squat, Bench, Deadlift) over a 6-week training block.

---

## File Structure

| File | Purpose |
|------|---------|
| `Inputs.csv` | Configuration sheet - enter your 1RMs and select accessories |
| `Week 1.csv` | Hypertrophy phase (moderate difficulty) |
| `Week 2.csv` | Hypertrophy phase (higher difficulty) |
| `Week 3.csv` | Linear Max OT (overtraining) phase |
| `Week 4.csv` | Heavy weight acclimation |
| `Week 5.csv` | High intensity strength (rep maxes) |
| `Projected.csv` | 1RM calculator based on Week 5 performance |
| `Taper.csv` | Competition peaking week |
| `Deload.csv` | Recovery week (reduced volume) |

---

## CSV Format

All files use **semicolon (`;`) as delimiter** with this column structure:

```
;Lift;Wt.;RPE;Sets;Reps;
```

| Column | Description |
|--------|-------------|
| Lift | Exercise name (Squat, Bench, Deadlift, accessory name) |
| Wt. | Weight in kg (calculated from 1RM) or blank for RPE-based |
| RPE | Rate of Perceived Exertion (7-10 scale) or `-` if weight is prescribed |
| Sets | Number of sets |
| Reps | Repetitions per set (can be range like `6-10` or `8-12`) |

---

## Inputs Sheet Configuration

### User Stats
```
Squat 1RM:     170 kg
Deadlift 1RM:  230 kg
Bench 1RM:     105 kg
Desired Bench: 110 kg (2-5% above current)
Unit:          kg
Loading Unit:  2.5 kg increments
```

### Bench Accessories (4 Categories)

| Category | Selected | Purpose | Alternatives |
|----------|----------|---------|--------------|
| Low Pin Press | Low Pin Press | Bottom-range strength | Low Board Press, 3ct Pause Bench, Wide Grip Bench |
| High Pin Press | High Pin Press | Lockout strength | High Board Press, 2ct Pause Bench, Close Grip Bench |
| High Specificity | Close Grip Bench | Transferable variation | Spoto Press, Feet Up Bench, Larsen Press, 2ct Pause Bench |
| Low Specificity | Incline Bench | Hypertrophy/general | Incline DB Press, Incline DB Flys, Flat DB Flys, Incline Cable Flys |

### Upper Body Accessories
- **Back - Horizontal**: Barbell Row
- **Shoulders**: OHP (Overhead Press)
- **Back - Vertical**: Weighted Pull-up

### Deadlift Variation
- **Selected**: Pause Deadlift
- **Options**: Candito DL, Stiff Leg DL, Snatch Grip Conv. DL, Deficit DL, Conv. DL

---

## Weekly Phases Breakdown

### Week 1: Hypertrophy (Moderate Difficulty)
**Training Days**: Monday, Tuesday, Thursday, Friday, Saturday (5 days)

| Day | Focus | Key Lifts |
|-----|-------|-----------|
| Monday | Lower + Bench | Squat 4×6 @80%, Bench 3×3 @69%, Deadlift 2×6 @80% |
| Tuesday | Upper | Bench 3×3, Incline Bench RPE9, Row/OHP/Pull-ups |
| Thursday | Upper | Bench 3×3, Close Grip RPE9, Row/OHP/Pull-ups |
| Friday | Lower + Bench | Squat 4×8 @71%, Bench 3×3, Deadlift 2×8 @70% |
| Saturday | Upper | Bench 3×3, Close Grip RPE9, Row/OHP/Pull-ups |

**Bench Programming**: 72.5 kg × 3×3 (69% of 105kg 1RM) across all days

---

### Week 2: Hypertrophy (Higher Difficulty)
**Training Days**: Monday, Tuesday, Thursday, Friday, Sunday (5 days)

**Key Features**:
- **MR10 Sets**: Max reps at RPE10 (test sets)
- **Back-off Sets**: Volume work after MR10 based on performance
- **Bench Singles**: Introduction of heavy singles (95kg = 90% 1RM)

| Day | Key Work |
|-----|----------|
| Monday | Squat MR10 @80% + 5×3 back-off, Bench single @90% + 3×3 @76% |
| Tuesday | Bench 3×3, Low Pin Press RPE9 |
| Thursday | Bench 3×3, High Pin Press RPE9 |
| Friday | Squat MR10 @81% + back-off, Bench 3×3, Low Pin Press RPE9 |
| Sunday | Bench 3×3, High Pin Press RPE9 |

**MR10 Back-off Protocol**:
- 10 reps achieved → 10×3 with 60s rest
- 8-9 reps achieved → 8×3 with 60s rest
- 7 reps achieved → 5×3 with 60s rest
- <7 reps → Skip back-off, reduce 1RM by 2.5%

---

### Week 3: Linear Max OT Phase
**Training Days**: Monday, Tuesday, Wednesday, Friday, Saturday (5 days)

**Focus**: Heavier weights, reduced accessories

| Day | Key Work |
|-----|----------|
| Monday | Squat 3×4-6 @87%, Bench single + 3×3, Deadlift 3×3-6 @88% — NO ACCESSORIES |
| Tuesday | Bench 3×3, Close Grip 3×12 RPE9 |
| Wednesday | Bench 3×3, Incline 3×12 RPE9 |
| Friday | Squat 1×4-6 @88%, Bench 3×3, Close Grip 3×10 — NO ACCESSORIES |
| Saturday | Bench 3×3, Incline 3×10 RPE9 |

**Bench**: 80-85 kg range (76-81% 1RM)

---

### Week 4: Heavy Weight Acclimation
**Training Days**: Monday, Tuesday, Thursday, Friday (4 days)

**Key Features**:
- Heavy ascending triples for Squat
- **PR Peak Sets**: 15-20 rep max tests for bench accessories
- High volume bench (10×3)

| Day | Key Work |
|-----|----------|
| Monday | Squat 150→152.5→155 kg (3×3 ascending) |
| Tuesday | Bench 10×3 @83-86%, Close Grip PR Peak Set 15-20 reps |
| Thursday | Squat heavy singles, Deadlift heavy singles |
| Friday | Bench 5-10×3 @86-93%, Incline PR Peak Set 15-20 reps |

---

### Week 5: High Intensity Strength
**Training Days**: Monday, Wednesday, Friday, Saturday (4 days)

**Focus**: Rep maxes at near-maximal weights (RPE10)

| Day | Key Work |
|-----|----------|
| Monday | Squat 1×1-7 @97% RPE10, Deadlift work |
| Wednesday | **Bench 1×1-7 @97.5% RPE10** (test day) |
| Friday | Deadlift 1×1-7 @98% RPE10 |
| Saturday | Bench RPE10 ×5 reps + 5×3 @88% |

**Expected Performance**: 2-4 reps at these weights is excellent

---

### Week 6 Options (Projected.csv)

After Week 5, choose one path:

1. **Projected Maxes Only**: Use calculator to estimate new 1RMs, start next cycle
2. **Deload + Projected**: Use projected max, take recovery week
3. **Taper + Test**: Actually test true 1RMs in competition format

**1RM Projection Formula** (from `Projected.csv`):
| Reps @RPE10 | % of Max | Multiplier |
|-------------|----------|------------|
| 1 | 100% | 1.00 |
| 2 | 96% | 1.04 |
| 3 | 92% | 1.09 |
| 4 | 89% | 1.12 |
| 5 | 86% | 1.16 |
| 6 | 84% | 1.19 |
| 7 | 81% | 1.23 |

---

### Taper Week (Competition Prep)

**Structure**: 5 training days culminating in test day

| Day | Purpose |
|-----|---------|
| Monday | Openers practice: Squat @92%, Bench @93% |
| Tuesday | Deadlift opener @92%, Bench singles @86% |
| Thursday | Light triples all lifts |
| Friday | Very light work (recovery) |
| Sunday | **TEST DAY**: 3 attempts each lift (opener → 2nd → 3rd @RPE10) |

---

### Deload Week

**Purpose**: Recovery between training blocks

- Same structure as Week 1
- Uses original 1RMs (not new projected maxes)
- **Skip all accessories**
- **Skip last upper workout**
- Reduced intensity and volume

---

## RPE Scale Reference

| RPE | Meaning | Reps in Reserve |
|-----|---------|-----------------|
| 7 | Could do 3 more reps | 3 RIR |
| 8 | Could do 2 more reps | 2 RIR |
| 9 | Could do 1 more rep | 1 RIR |
| 10 | Maximum effort (failure) | 0 RIR |

---

## Key Program Rules

1. **Failed Rep Protocol**: Reduce 1RM by 2.5% for future calculations
2. **Weight Rounding**: Use 2.5 kg increments (standard plate loading)
3. **MR Sets**: If <7 reps achieved, reduce 1RM by at least 2.5%
4. **Accessories**: RPE-based (no fixed weight) - autoregulate based on fatigue

---

## Bench Press Programming Analysis (Current)

The Candito program uses **low-volume, moderate-intensity** bench work:

| Week | Primary Bench Work | Intensity |
|------|-------------------|-----------|
| 1 | 3×3 daily | 69% (72.5kg) |
| 2 | Singles + 3×3 | 90% + 76% |
| 3 | Singles + 3×3 | 90% + 76-81% |
| 4 | 5-10×3 | 83-93% |
| 5 | Rep max test | 97.5% |

**Observation**: Bench appears 4-5× per week but at very low volume (3×3) with the same weight repeated. This is the area targeted for modification with the new bench programming from the YouTube analysis.

---

## AI Context Notes

- Weights are calculated automatically from 1RM inputs in Excel
- Comma (`,`) is used as decimal separator (European format): `72,5` = 72.5 kg
- Some cells contain weight ranges (e.g., `80-85`) indicating lifter choice
- Notes/instructions appear in columns after the main data columns
- Empty `Wt.` column means use RPE to determine weight
