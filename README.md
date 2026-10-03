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
- Line clear flash animation + level-up rewards
- Impact Arcade enamel blocks, hard-drop contact trails, and bounded clear shards
- Score and combo rewards beside the board, with reduced-motion support
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

Choose one of six visual styles and a **Dark** or **Bright** color mode from the
options screen. Both selections are persisted in `localStorage`.

New players start with **Impact Arcade**. Existing saved styles are preserved.
All six themes share its angular Oxanium display type, narrow Rajdhani labels,
thin frames, menu layout, and enamel block details. Glass, Bloom, Calm, Mono,
and Focus retain their existing dark/bright background, text, button, board,
piece, and preview palettes. Their logo and rewards use accents from those
palettes; Impact Arcade keeps its cyan and gold accents. The Latin font subsets are bundled in
`assets/fonts/fonts.css` with SIL Open Font License notices alongside them;
the game does not request fonts from an external service at runtime.
This style uses an opaque graphite playfield in both color modes, solid enamel
pieces, and an outline-only ghost. A transparent Canvas layer renders contact
trails and shards outside the playfield from copies of the locked cells and
cleared rows. Effects do not consume the bag randomizer or alter scoring,
collision, or the existing 300ms clear transition. They freeze while paused and
are discarded on restart or game over. Reduced motion skips these effects.

- All colors — background, panels, text, borders, overlays — are driven by CSS custom properties defined in `style.css` under `[data-theme="dark"]` and `[data-theme="bright"]` blocks.
- Canvas colors are cached whenever appearance changes, so themed bevels, outlines, and ghost styling do not require repeated computed-style reads for every cell.
- Piece colors (`--piece-i` … `--piece-l`) are loaded from CSS vars at game start and on every theme switch via `loadPieceColors()`, enabling future per-theme palette overrides without any JS changes.
- Flash animation and action text use `--text-accent` (white in dark, black in bright) for legibility on both backgrounds.
