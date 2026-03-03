# Tetris

Dark theme Tetris — built with pure HTML, CSS, and Vanilla JavaScript.
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
- CSS3 (dark/bright themes via CSS custom properties, animations)
- Vanilla JavaScript (single IIFE, no dependencies)

## Theme System

Select **Dark** or **Bright** theme on the start screen (persisted in `localStorage`).

- All colors — background, panels, text, borders, overlays — are driven by CSS custom properties defined in `style.css` under `[data-theme="dark"]` and `[data-theme="bright"]` blocks.
- Canvas rendering is also fully themed: `drawCell()` reads `--cell-bevel-light` and `--cell-bevel-shadow` via `getCssVar()` on every frame, so the piece bevel effect adapts correctly to both light and dark backgrounds.
- Piece colors (`--piece-i` … `--piece-l`) are loaded from CSS vars at game start and on every theme switch via `loadPieceColors()`, enabling future per-theme palette overrides without any JS changes.
- Flash animation and action text use `--text-accent` (white in dark, black in bright) for legibility on both backgrounds.
