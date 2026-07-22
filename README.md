# Tetris

Themeable Tetris — built with pure HTML, CSS, and Vanilla JavaScript.
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
- Responsive on-screen controls for touch and narrow screens
- Keyboard-accessible menus, reduced-motion support, and live game status

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

On screens up to 900px wide, the same actions are available through the
on-screen controls below the board.

## How to run

```bash
open index.html      # macOS
xdg-open index.html  # Linux
# or just double-click index.html
```

## Tech stack

- HTML5 Canvas
- CSS3 (dark/bright themes via CSS custom properties, animations)
- Vanilla JavaScript (`file://`-compatible IIFE/UMD modules, no dependencies)

`game-engine.js` contains pure input, spawn, persistence, and T-spin rules.
`game-input.js` normalizes keyboard, pointer, and touch controls. `game.js` owns
runtime state, screen transitions, and Canvas rendering. Every input method
dispatches the same game actions.

## Tests

Run all unit and runtime integration tests with Node.js:

```bash
node --test
```

The suite covers game rules, standard keyboard codes, Hold locking, persisted
value recovery, theme rendering, and visual-effect state.

## Theme System

Choose one of five visual styles and a **Dark** or **Bright** color mode from the
options screen. Both selections are persisted in `localStorage`.

- All colors — background, panels, text, borders, overlays — are driven by CSS custom properties defined in `style.css` under `[data-theme="dark"]` and `[data-theme="bright"]` blocks.
- Canvas colors are cached whenever appearance changes, so themed bevels, outlines, and ghost styling do not require repeated computed-style reads for every cell.
- Piece colors (`--piece-i` … `--piece-l`) are loaded from CSS vars at game start and on every theme switch via `loadPieceColors()`, enabling future per-theme palette overrides without any JS changes.
- Flash animation and action text use `--text-accent` (white in dark, black in bright) for legibility on both backgrounds.
