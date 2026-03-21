# MathBlaster: Contra x Math Puzzle — Game Design Proposal

## Overview

**Title:** MathBlaster
**Platform:** Android
**Genre:** Side-scrolling Action + Math Puzzle
**Target Audience:** Kids and teens (ages 7–16), parents who want educational gaming
**Engine:** Unity (Android export) or Godot 4 (Android)

---

## Concept

A Contra-style side-scrolling shooter where the hero can only fire by solving multiplication table puzzles in real time. The faster the player solves the puzzle, the more powerful the shot. Enemies advance relentlessly — hesitation is deadly.

The core loop creates a genuine tension: *enemies are coming, you MUST think fast*.

---

## Gameplay Loop

```
Enemies approach → Puzzle appears on screen → Player solves it → Hero shoots
     ↑                                                                  |
     └──────────────── Enemies keep moving closer ────────────────────┘
```

1. The hero auto-runs through levels (or player controls left/right movement).
2. An enemy appears — a puzzle card pops up instantly (e.g., **4 × 7 = ?**).
3. Player taps the correct answer from 4 multiple-choice options.
4. Correct + fast → powerful shot (kills enemy, hero survives).
5. Wrong answer → hero takes damage.
6. Too slow → enemy reaches and damages hero.
7. Defeat all enemies → level complete → next level loads.

---

## Core Features

### 1. Multiplication Puzzle System
| Level Range | Puzzle Type | Example |
|---|---|---|
| 1–3 | Tables 2x and 3x | 2×3, 3×4 |
| 4–6 | Tables 4x and 5x | 4×7, 5×6 |
| 7–9 | Tables 6x–8x | 6×8, 7×9 |
| 10–12 | Tables 9x–12x | 9×7, 12×8 |
| 13+ | Mixed random, all tables | 11×7, 8×12 |
| Boss levels | Double-step (2×3)+(4×1) | Chain puzzles |

### 2. Shot Power Based on Response Speed
| Time to Answer | Shot Type | Effect |
|---|---|---|
| < 1 second | Mega Blast | Destroys all enemies on screen |
| 1–2 seconds | Power Shot | One-hit kill |
| 2–4 seconds | Normal Shot | Standard damage |
| > 4 seconds | Weak Shot | Half damage |
| Wrong answer | Miss | No shot, hero takes hit |

### 3. Hero & Abilities
- **Hero Name:** Alex (customizable gender/skin)
- **Weapon:** Blaster (upgradeable with coins earned from speed)
- **Special Move:** "Math Nuke" — solve 3 puzzles in a row under 1s each → screen-clearing explosion
- **Health:** 3 hearts per level; refill between levels

### 4. Enemy Types
| Enemy | Behavior | Puzzle Difficulty |
|---|---|---|
| Grunt | Walks forward slowly | Easy (2x, 3x) |
| Runner | Sprints fast | Medium (4x–6x) |
| Tank | Takes 3 hits | Hard (7x–9x) |
| Drone | Flies, shoots back | Mixed |
| Boss | Phase-based, multiple puzzles | Chain puzzles |

### 5. Level Progression & Difficulty Scaling

Difficulty scales on two axes:

**A. Puzzle Difficulty** — harder multiplication tables as levels increase.

**B. Time Pressure** — enemy walk speed increases each level. By level 10, enemies move 2× faster than level 1.

**C. Enemy Count** — more enemies per wave each level.

**D. Speed Bonus Tracking** — the game tracks average answer time per session. If the player is consistently fast, it bumps difficulty faster (adaptive scaling).

---

## Levels & World Design

| World | Theme | Levels | Boss |
|---|---|---|---|
| World 1 | Jungle | 1–5 | Giant Gorilla Bot |
| World 2 | City Ruins | 6–10 | Mech Soldier |
| World 3 | Arctic Base | 11–15 | Ice Titan |
| World 4 | Space Station | 16–20 | Alien Commander |
| Endless Mode | Random | ∞ | Rotating bosses |

---

## UI / UX Design

### In-Game HUD
```
[Hearts: ♥♥♥]          [Level: 7]          [Score: 4200]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        [GAME SCREEN — Hero runs, enemies approach]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              ┌─────────────────────┐
              │   6 × 8 = ?         │  ← Puzzle card
              │  [42]  [48]  [54]  [36]  │  ← Answer buttons
              └─────────────────────┘
[⬅️]  [➡️]   [Jump]              [Timer bar drains →]
```

- Puzzle card appears center-bottom, large and readable.
- Answer options: 4 big tap targets (accessible for small fingers).
- A color-coded timer bar drains — green → yellow → red.
- Correct answer flashes green + satisfying sound.
- Wrong answer flashes red + enemy lurches forward.

---

## Scoring & Rewards

- **Speed Score:** Bonus points for answering in < 2 seconds.
- **Streak Bonus:** 5 correct in a row → 2× score multiplier.
- **Coins:** Earned per level, used to unlock skins and weapon upgrades.
- **Stars:** 3-star rating per level based on speed + no damage taken.
- **Leaderboard:** Global and friend-based (Google Play Games).

---

## Progression & Motivation

- **Unlock system:** New heroes, worlds, and weapons unlocked at milestones.
- **Daily Challenge:** Special puzzle theme each day (e.g., "Only 7x table today").
- **Report Card:** Weekly summary of which tables the player struggles with most — helps parents/teachers see learning progress.
- **Achievements:** "Lightning Learner" (10 answers < 1s), "Table Master" (complete all 12x levels), etc.

---

## Educational Value

- Reinforces multiplication table fluency through high-pressure, engaging repetition.
- Adaptive difficulty ensures the player is always challenged but not frustrated.
- The **Report Card** feature makes this useful for schools and parents.
- Game anxiety drives faster mental math recall — the same mechanism used in competitive math drills, but fun.

---

## Monetization (Optional / Freemium)

| Item | Model |
|---|---|
| Base game | Free |
| Worlds 1–2 | Free |
| Worlds 3–4 + Endless | One-time unlock ($1.99) |
| Cosmetic skins | Optional purchase |
| No ads during gameplay | Keeps learning flow intact |

> **Note:** No pay-to-win mechanics. All gameplay advantages come from solving puzzles faster.

---

## Technical Stack

| Component | Technology |
|---|---|
| Engine | Godot 4 (GDScript) or Unity (C#) |
| Platform | Android (API 26+) |
| Backend (optional) | Firebase (leaderboard, progress sync) |
| Audio | 8-bit chiptune soundtrack + SFX |
| Art Style | Pixel art, 16-bit retro aesthetic |

---

## Development Milestones

| Phase | Deliverable | Duration |
|---|---|---|
| Phase 1 | Core loop — hero, enemies, puzzle system, 1 world | 6 weeks |
| Phase 2 | All 4 worlds, boss fights, scoring | 6 weeks |
| Phase 3 | UI polish, sound, animations | 3 weeks |
| Phase 4 | Leaderboard, achievements, Report Card | 2 weeks |
| Phase 5 | QA, Play Store submission | 2 weeks |
| **Total** | | **~19 weeks** |

---

## Summary

MathBlaster makes multiplication tables unavoidable — not through repetitive drills, but through the adrenaline of a Contra-style battle. Every bullet fired is a math problem solved. Every level beaten is a table mastered. It's a game kids will want to play, and parents will want them to play.

> **"Shoot faster. Think faster."**
