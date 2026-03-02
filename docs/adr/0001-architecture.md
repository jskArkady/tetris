# ADR-0001: Tetris Game Architecture

## Status
Accepted

## Context
Building a Tetris web game with only HTML + CSS + Vanilla JS (no libraries, no build tools). Need to decide on:
1. File structure and responsibility split
2. Game loop approach
3. State management pattern
4. Rendering approach

## Decision

### 1. File Structure — 3-File Split
- **index.html**: DOM structure only — canvas element, HUD containers (score/level/lines), side panels (hold/next), overlay screens (start/pause/game-over). No inline JS or styles.
- **style.css**: All layout, theming, overlay styling, responsive rules. Canvas sizing via CSS. Dark theme default.
- **game.js**: All game logic, state, rendering, input handling. Single file using sectioned IIFE to avoid global pollution.

**Why single JS file**: With no build tools, module splitting means multiple `<script>` tags with load-order coupling. A single well-structured IIFE with clear section comments is simpler and avoids dependency issues. Sections act as logical modules.

### 2. Game Loop — requestAnimationFrame with deltaTime
- Use `requestAnimationFrame` for the main loop.
- Track `deltaTime` between frames for all time-based logic (gravity, lock delay, DAS/ARR).
- Game logic accumulates time and steps at fixed intervals; rendering happens every frame.

**Why not setInterval**: `setInterval` doesn't sync with display refresh, causes visual jitter, and doesn't pause when tab is backgrounded. `requestAnimationFrame` gives smooth 60fps, automatic pause on tab switch, and better battery life on mobile.

### 3. State Management — Single State Object
- One `gameState` object holds all mutable state:
  ```
  {
    board: number[][],        // 10×22 grid (0=empty, 1-7=piece color)
    current: { type, rotation, x, y },
    ghost: { y },
    hold: { type, used },
    bag: number[],
    next: number[],
    score, level, lines, combo,
    lockTimer, lockResets,
    phase: 'idle'|'playing'|'paused'|'gameover',
    lastAction: { isTetris, isTSpin }  // for back-to-back tracking
  }
  ```
- State is mutated directly (no immutability overhead needed for single-threaded game).
- All state changes go through named functions (e.g., `movePiece`, `rotatePiece`, `lockPiece`) — never raw mutation from input handlers.

**Why not classes/OOP**: For a single-file game of this scope, classes add ceremony without benefit. Plain functions + state object is more direct and easier to follow.

### 4. Rendering — HTML5 Canvas (2D Context)
- Main playfield rendered on a single `<canvas>` element.
- Hold piece and Next queue rendered on separate smaller `<canvas>` elements (avoids complex coordinate math).
- Score/level/lines displayed via DOM elements (HTML spans updated from JS).
- Overlay screens (start/pause/game-over) are HTML/CSS overlays toggled via class.

**Why Canvas over DOM**:
- DOM rendering (div-per-cell) means 200+ elements updated every frame — expensive reflows.
- Canvas `fillRect` for grid cells is simple and fast.
- Ghost piece transparency is trivial with `globalAlpha`.
- Line clear animation (flash effect) is easy with canvas.
- No complex CSS transform state to track.

**Why not full-Canvas UI**: Score text, screens, and overlays benefit from HTML/CSS — text rendering, centering, transitions are all simpler in CSS than manual canvas text layout.

## Consequences

### Positive
- Simple mental model: one file per concern, one state object, one loop.
- No build step — open index.html and play.
- Canvas gives consistent pixel-perfect rendering across browsers.
- requestAnimationFrame handles tab-backgrounding automatically.

### Negative
- Single JS file will be 500-800 lines — requires disciplined section organization.
- No hot-module-reload during development (just browser refresh).
- Canvas text rendering less crisp than DOM at non-integer scales (mitigated by using DOM for text).

### Risks
- Large single file could become hard to navigate — mitigate with clear section headers and function naming.
- Canvas pixel ratio issues on HiDPI displays — mitigate by setting canvas width/height to `devicePixelRatio` scaled values.

## Alternatives Considered

### DOM-based rendering (div per cell)
- Rejected: 200+ DOM nodes updated at 60fps causes layout thrashing. CSS transitions for animations are harder to synchronize with game state.

### Multiple JS files with ES modules
- Rejected: ES modules require `type="module"` which doesn't work with `file://` protocol in some browsers (CORS restrictions). Would need a local server, violating the "just open index.html" requirement.

### setInterval for game loop
- Rejected: No vsync, causes visual stutter. Doesn't auto-pause on tab background. Worse battery impact.

### Class-based OOP architecture
- Rejected: Adds abstraction overhead for a small single-file game. Functions + plain objects are sufficient and more explicit.
