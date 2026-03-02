# Tetris

Bloomberg-style dark theme Tetris — built with pure HTML, CSS, and Vanilla JavaScript.
No libraries, no build tools. Open `index.html` in any modern browser and play.

## Features

- All 7 tetrominoes with correct **SRS rotation** and wall kicks
- **Ghost piece** — shows landing position
- **Hold piece** (C / Shift)
- **Next 3 pieces** preview with 7-bag randomizer
- **Hard drop** (Space) / **Soft drop** (↓)
- **T-spin** detection (3-corner rule) + Mini T-spin
- **Back-to-back** bonus
- Full **scoring**: single / double / triple / Tetris × level + combo + drop bonuses
- **Level progression** every 10 lines (speed increases)
- Lock delay (500ms) with up to 15 move resets
- DAS / ARR smooth left-right movement
- Start / Pause / Game Over screens
- Line clear flash animation + level-up overlay
- High score persistence (localStorage)
- Touch / swipe controls (mobile)

## Controls

| Key | Action |
|-----|--------|
| ← → | Move left / right |
| ↓ | Soft drop |
| Space | Hard drop |
| ↑ / X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| C / Shift | Hold piece |
| P / Esc | Pause |

## How to run

```bash
open index.html      # macOS
xdg-open index.html  # Linux
# or just double-click index.html
```

## Tech stack

- HTML5 Canvas
- CSS3 (dark theme, animations)
- Vanilla JavaScript (single IIFE, no dependencies)
