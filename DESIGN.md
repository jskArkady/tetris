# DESIGN.md — Tetris Web Game

## File Structure

```
tetris/
├── index.html      — DOM structure, canvas elements, overlay screens
├── style.css       — Layout, theming, responsive, animations
├── game.js         — All game logic, state, rendering, input
├── DESIGN.md       — This file
├── tasks/
│   └── todo.md     — Implementation checklist
└── docs/
    └── adr/
        └── 0001-architecture.md
```

---

## Tetrominoes

### Piece Definitions (SRS)

All pieces defined in a 4×4 bounding box. Coordinates are [row, col] offsets from top-left of bounding box.

| Piece | Color   | Hex       |
|-------|---------|-----------|
| I     | Cyan    | `#00F0F0` |
| O     | Yellow  | `#F0F000` |
| T     | Purple  | `#A000F0` |
| S     | Green   | `#00F000` |
| Z     | Red     | `#F00000` |
| J     | Blue    | `#0000F0` |
| L     | Orange  | `#F0A000` |

### Rotation States (SRS)

Each piece has 4 rotation states (0, R, 2, L). Stored as arrays of [row, col] for each filled cell.

**I Piece:**
```
State 0:        State R:        State 2:        State L:
. . . .         . . I .         . . . .         . I . .
I I I I         . . I .         . . . .         . I . .
. . . .         . . I .         I I I I         . I . .
. . . .         . . I .         . . . .         . I . .
```

**O Piece:**
```
State 0/R/2/L (all identical):
. O O .
. O O .
. . . .
. . . .
```

**T Piece:**
```
State 0:        State R:        State 2:        State L:
. T .           . T .           . . .           . T .
T T T           . T T           T T T           T T .
. . .           . T .           . T .           . T .
```

**S Piece:**
```
State 0:        State R:        State 2:        State L:
. S S           . S .           . . .           S . .
S S .           . S S           . S S           S S .
. . .           . . S           S S .           . S .
```

**Z Piece:**
```
State 0:        State R:        State 2:        State L:
Z Z .           . . Z           . . .           . Z .
. Z Z           . Z Z           Z Z .           Z Z .
. . .           . Z .           . Z Z           Z . .
```

**J Piece:**
```
State 0:        State R:        State 2:        State L:
J . .           . J J           . . .           . J .
J J J           . J .           J J J           . J .
. . .           . J .           . . J           J J .
```

**L Piece:**
```
State 0:        State R:        State 2:        State L:
. . L           . L .           . . .           L L .
L L L           . L .           L L L           . L .
. . .           . L L           L . .           . L .
```

### SRS Wall Kick Data

**JLSTZ Kicks** (5 tests per rotation transition):

| Rotation    | Test 1  | Test 2  | Test 3  | Test 4  | Test 5  |
|-------------|---------|---------|---------|---------|---------|
| 0 → R      | (0,0)   | (0,-1)  | (-1,-1) | (2,0)   | (2,-1)  |
| R → 0      | (0,0)   | (0,1)   | (1,1)   | (-2,0)  | (-2,1)  |
| R → 2      | (0,0)   | (0,1)   | (1,1)   | (-2,0)  | (-2,1)  |
| 2 → R      | (0,0)   | (0,-1)  | (-1,-1) | (2,0)   | (2,-1)  |
| 2 → L      | (0,0)   | (0,1)   | (-1,1)  | (2,0)   | (2,1)   |
| L → 2      | (0,0)   | (0,-1)  | (1,-1)  | (-2,0)  | (-2,-1) |
| L → 0      | (0,0)   | (0,-1)  | (1,-1)  | (-2,0)  | (-2,-1) |
| 0 → L      | (0,0)   | (0,1)   | (-1,1)  | (2,0)   | (2,1)   |

**I Piece Kicks** (different table):

| Rotation    | Test 1  | Test 2  | Test 3  | Test 4  | Test 5  |
|-------------|---------|---------|---------|---------|---------|
| 0 → R      | (0,0)   | (0,-2)  | (0,1)   | (-1,-2) | (2,1)   |
| R → 0      | (0,0)   | (0,2)   | (0,-1)  | (1,2)   | (-2,-1) |
| R → 2      | (0,0)   | (0,-1)  | (0,2)   | (2,-1)  | (-1,2)  |
| 2 → R      | (0,0)   | (0,1)   | (0,-2)  | (-2,1)  | (1,-2)  |
| 2 → L      | (0,0)   | (0,2)   | (0,-1)  | (1,2)   | (-2,-1) |
| L → 2      | (0,0)   | (0,-2)  | (0,1)   | (-1,-2) | (2,1)   |
| L → 0      | (0,0)   | (0,1)   | (0,-2)  | (-2,1)  | (1,-2)  |
| 0 → L      | (0,0)   | (0,-1)  | (0,2)   | (2,-1)  | (-1,2)  |

Kick values are (row_offset, col_offset) where negative row = up, positive col = right.

---

## Game State (Data Model)

```javascript
const state = {
  // Board: 22 rows × 10 cols. Rows 0-1 are hidden (above visible area).
  // 0 = empty, 1-7 = piece type (maps to color).
  board: Array(22).fill(null).map(() => Array(10).fill(0)),

  // Current piece
  current: {
    type: 0,       // 1-7 (I,O,T,S,Z,J,L)
    rotation: 0,   // 0,1,2,3 (0=spawn, 1=R, 2=2, 3=L)
    x: 0,          // column of bounding box top-left
    y: 0,          // row of bounding box top-left
  },

  // Ghost piece (only y differs from current)
  ghostY: 0,

  // Hold
  hold: {
    type: 0,       // 0 = empty, 1-7 = held piece
    locked: false, // true = already held this turn, cannot hold again
  },

  // Bag & Next queue
  bag: [],         // remaining pieces in current bag
  next: [],        // next 3+ pieces to spawn

  // Scoring
  score: 0,
  level: 1,
  lines: 0,
  combo: -1,       // -1 = no active combo, 0+ = consecutive clears

  // Back-to-back tracking (P1)
  backToBack: false, // true if last clear was tetris or T-spin

  // Lock delay
  lockTimer: 0,      // ms elapsed since piece touched surface
  lockResets: 0,     // number of move/rotate resets this piece
  isOnSurface: false,

  // DAS/ARR
  das: { direction: 0, timer: 0, active: false },

  // Game phase
  phase: 'idle',   // 'idle' | 'playing' | 'paused' | 'gameover'

  // Animation
  clearingRows: [],    // rows currently animating clear
  clearAnimTimer: 0,   // ms elapsed in clear animation

  // T-spin detection (P1)
  lastWasRotation: false,
  lastKickUsed: 0,
};
```

---

## Module/Function Decomposition (game.js)

game.js is a single IIFE with clearly separated sections:

```javascript
(function() {
  'use strict';

  // ═══════════════════════════════════════════
  // SECTION 1: CONSTANTS
  // ═══════════════════════════════════════════
  const COLS = 10;
  const ROWS = 22;              // 20 visible + 2 hidden
  const VISIBLE_ROWS = 20;
  const CELL_SIZE = 30;         // pixels per cell
  const LOCK_DELAY = 500;       // ms
  const MAX_LOCK_RESETS = 15;
  const DAS_DELAY = 167;        // ms
  const ARR_DELAY = 33;         // ms
  const CLEAR_ANIM_DURATION = 300; // ms

  const PIECES = { /* ... 7 pieces with 4 rotation states each */ };
  const COLORS = { /* ... piece type → hex color */ };
  const WALL_KICKS = { /* ... JLSTZ and I kick tables */ };
  const SCORING = { /* ... point values */ };
  const LEVEL_SPEEDS = [ /* ... ms per drop per level */ ];

  // ═══════════════════════════════════════════
  // SECTION 2: STATE
  // ═══════════════════════════════════════════
  let state = {};

  function initState() { /* reset all state to defaults */ }

  // ═══════════════════════════════════════════
  // SECTION 3: BAG RANDOMIZER
  // ═══════════════════════════════════════════
  function shuffleBag()      { /* Fisher-Yates shuffle of [1..7] */ }
  function nextPiece()       { /* pop from bag, refill if needed, maintain next queue */ }

  // ═══════════════════════════════════════════
  // SECTION 4: COLLISION & BOARD
  // ═══════════════════════════════════════════
  function getCells(type, rotation, x, y) { /* return absolute cell positions */ }
  function isValid(type, rotation, x, y)  { /* check no collision with walls/floor/filled cells */ }
  function lockPiece()       { /* write current piece cells to board, check game over */ }
  function clearLines()      { /* detect full rows, start clear animation, remove after anim */ }
  function collapseRows(rows) { /* remove cleared rows, shift everything above down */ }

  // ═══════════════════════════════════════════
  // SECTION 5: PIECE MOVEMENT
  // ═══════════════════════════════════════════
  function spawnPiece()      { /* place next piece at top center, check game over */ }
  function movePiece(dx, dy) { /* move if valid, return success bool */ }
  function rotatePiece(dir)  { /* SRS rotation with wall kicks, dir: 1=CW, -1=CCW */ }
  function hardDrop()        { /* instant drop to ghost + lock + score */ }
  function softDrop()        { /* move down 1, score if successful */ }
  function updateGhost()     { /* project current piece down to find ghost Y */ }
  function holdPiece()       { /* swap current with hold, respect lock flag */ }

  // ═══════════════════════════════════════════
  // SECTION 6: SCORING
  // ═══════════════════════════════════════════
  function addScore(action, linesCleared) { /* calculate and add points */ }
  function updateLevel()     { /* check if level should increase */ }
  function detectTSpin()     { /* P1: 3-corner T-spin detection */ }

  // ═══════════════════════════════════════════
  // SECTION 7: INPUT HANDLING
  // ═══════════════════════════════════════════
  const keys = {};           // currently pressed keys

  function onKeyDown(e)      { /* handle key press, prevent default for game keys */ }
  function onKeyUp(e)        { /* handle key release */ }
  function processInput(dt)  { /* DAS/ARR logic for held directional keys */ }

  // ═══════════════════════════════════════════
  // SECTION 8: GAME LOOP
  // ═══════════════════════════════════════════
  function update(dt)        { /* gravity, lock delay, clear animation, input processing */ }
  function gameLoop(timestamp) { /* rAF callback: calc dt, update, render, request next */ }

  // ═══════════════════════════════════════════
  // SECTION 9: RENDERING
  // ═══════════════════════════════════════════
  function renderBoard()     { /* draw grid + filled cells on main canvas */ }
  function renderPiece()     { /* draw current piece */ }
  function renderGhost()     { /* draw ghost piece (semi-transparent) */ }
  function renderHold()      { /* draw hold piece on hold canvas */ }
  function renderNext()      { /* draw next 3 pieces on next canvas */ }
  function renderHUD()       { /* update DOM elements: score, level, lines */ }
  function renderClearAnim() { /* flash/fade animating rows */ }
  function render()          { /* orchestrate all render calls */ }

  // ═══════════════════════════════════════════
  // SECTION 10: SCREENS & PHASE
  // ═══════════════════════════════════════════
  function showScreen(id)    { /* show overlay by id, hide others */ }
  function hideScreens()     { /* hide all overlays */ }
  function startGame()       { /* init state, hide start screen, begin loop */ }
  function pauseGame()       { /* show pause overlay, stop loop */ }
  function resumeGame()      { /* hide pause overlay, resume loop */ }
  function gameOver()        { /* show game over screen with score */ }

  // ═══════════════════════════════════════════
  // SECTION 11: INITIALIZATION
  // ═══════════════════════════════════════════
  function init() {
    // Cache DOM refs (canvases, HUD elements)
    // Set canvas sizes (with devicePixelRatio)
    // Attach event listeners
    // Show start screen
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);
})();
```

---

## CSS Architecture

### Layout
```
┌──────────────────────────────────────────┐
│              body (dark bg)              │
│  ┌─────┐  ┌────────────┐  ┌──────────┐ │
│  │HOLD │  │            │  │ NEXT     │ │
│  │     │  │   BOARD    │  │ piece 1  │ │
│  └─────┘  │  (canvas)  │  │ piece 2  │ │
│           │  10×20     │  │ piece 3  │ │
│  ┌─────┐  │            │  └──────────┘ │
│  │SCORE│  │            │               │
│  │LEVEL│  │            │               │
│  │LINES│  └────────────┘               │
│  └─────┘                                │
└──────────────────────────────────────────┘
```

### Theme (CSS Custom Properties)
```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-board: #0a0a1a;
  --text-primary: #e0e0e0;
  --text-accent: #00d4ff;
  --grid-line: rgba(255,255,255,0.05);
  --cell-size: 30px;
}
```

### Key CSS Decisions
- Flexbox for main layout (centering board + side panels)
- CSS Grid not needed — simple 3-column layout
- Overlay screens use `position: absolute` + `display: none/flex` toggle
- Canvas elements have explicit width/height attributes (not CSS-scaled, to avoid blur)
- `@media (max-width: 600px)`: reduce cell-size, stack side panels below board
- No CSS animations on canvas content — all canvas animation done in JS
- CSS transitions only for overlay screen fade-in/out

---

## Scoring Table

### Line Clears
| Action          | Points          |
|-----------------|-----------------|
| Single          | 100 × level     |
| Double          | 300 × level     |
| Triple          | 500 × level     |
| Tetris          | 800 × level     |

### T-Spin (P1)
| Action              | Points          |
|---------------------|-----------------|
| T-Spin (no lines)   | 400 × level     |
| T-Spin Single       | 800 × level     |
| T-Spin Double       | 1200 × level    |
| T-Spin Triple       | 1600 × level    |
| T-Spin Mini         | 100 × level     |
| T-Spin Mini Single  | 200 × level     |

### Other
| Action              | Points          |
|---------------------|-----------------|
| Soft drop           | 1 per cell      |
| Hard drop           | 2 per cell      |
| Combo               | 50 × combo × level |
| Back-to-back (P1)   | 1.5× line clear score |

### Level Speed Curve

| Level | Drop Interval (ms) |
|-------|-------------------|
| 1     | 1000              |
| 2     | 793               |
| 3     | 618               |
| 4     | 473               |
| 5     | 355               |
| 6     | 262               |
| 7     | 190               |
| 8     | 135               |
| 9     | 94                |
| 10    | 64                |
| 11    | 43                |
| 12    | 28                |
| 13    | 18                |
| 14    | 11                |
| 15+   | 7                 |

Formula: `(0.8 - ((level-1) * 0.007))^(level-1) * 1000` (Tetris Guideline)

---

## Feature Priority

### P0 — Must Have
1. All 7 tetrominoes with correct SRS rotation states
2. SRS wall kicks (separate tables for I and JLSTZ)
3. Ghost piece (semi-transparent projection of landing position)
4. Hard drop (Space) — instant drop + lock + score
5. Soft drop (↓) — faster gravity + score per cell
6. Hold piece (C/Shift) — one swap per drop
7. Next 3 pieces preview
8. 7-bag randomizer (all 7 before repeat)
9. Scoring: single/double/triple/tetris × level
10. Combo scoring (50 × combo × level)
11. Soft/hard drop scoring
12. Level progression every 10 lines
13. Speed curve (gravity increases with level)
14. Lock delay (500ms) with move/rotate reset (max 15)
15. DAS (167ms) / ARR (33ms) smooth movement
16. Start screen
17. Pause screen (Escape toggle)
18. Game Over screen with final score
19. Line clear animation (flash/fade)
20. Game state machine (idle → playing → paused → gameover)

### P1 — Should Have
21. T-spin detection (3-corner rule)
22. T-spin scoring bonuses
23. Back-to-back bonus (1.5× for consecutive tetris/T-spin)
24. Level-up visual feedback (flash/text notification)
25. Piece lock animation (highlight on lock)

### P2 — Nice to Have
26. High score persistence (localStorage)
27. Touch/mobile controls (swipe gestures + tap)
