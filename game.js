/**
 * game.js — Tetris Web Game
 *
 * Single IIFE. No ES modules (file:// compatible).
 * Architecture follows ADR-0001: rAF loop, single state object, Canvas rendering.
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: CONSTANTS
  // All magic numbers live here. Never use raw literals in logic.
  // ═══════════════════════════════════════════════════════════════

  const COLS = 10;
  const ROWS = 22;           // 20 visible + 2 hidden rows above playfield
  const VISIBLE_ROWS = 20;
  const CELL_SIZE = 30;      // pixels per cell on the main board canvas

  // Lock delay: piece locks after LOCK_DELAY ms on surface if no move.
  // Each successful move/rotate resets the timer, capped at MAX_LOCK_RESETS
  // to prevent infinite stalling.
  const LOCK_DELAY = 500;
  const MAX_LOCK_RESETS = 15;

  // DAS = Delayed Auto Shift (time before held key triggers auto-repeat)
  // ARR = Auto Repeat Rate (interval between steps during auto-repeat)
  // Values match standard competitive Tetris defaults (167ms=10f@60fps, 33ms=2f)
  const DAS_DELAY = 167;
  const ARR_DELAY = 33;

  // Duration of the line-clear flash animation before rows collapse
  const CLEAR_ANIM_DURATION = 300; // ms

  // Small canvas layout constants for hold/next panels
  const PANEL_CELL_SIZE = 24; // pixels per cell in side panels

  // Piece type indices (1-based; 0 = empty cell)
  const PIECE_I = 1;
  const PIECE_O = 2;
  const PIECE_T = 3;
  const PIECE_S = 4;
  const PIECE_Z = 5;
  const PIECE_J = 6;
  const PIECE_L = 7;

  // Tetris Guideline colours per piece type — vivid, readable on both themes
  const PIECE_COLORS = {
    [PIECE_I]: '#00bcd4',
    [PIECE_O]: '#fdd835',
    [PIECE_T]: '#9c27b0',
    [PIECE_S]: '#4caf50',
    [PIECE_Z]: '#f44336',
    [PIECE_J]: '#1565c0',
    [PIECE_L]: '#ef6c00',
  };

  /**
   * THEME: Load piece colors from CSS vars so future per-theme palettes are
   * automatically picked up without touching JS. Falls back to hardcoded defaults
   * if the CSS var is empty (e.g. in unit-test environments).
   */
  function loadPieceColors() {
    PIECE_COLORS[PIECE_I] = getCssVar('--piece-i') || '#00bcd4';
    PIECE_COLORS[PIECE_O] = getCssVar('--piece-o') || '#fdd835';
    PIECE_COLORS[PIECE_T] = getCssVar('--piece-t') || '#9c27b0';
    PIECE_COLORS[PIECE_S] = getCssVar('--piece-s') || '#4caf50';
    PIECE_COLORS[PIECE_Z] = getCssVar('--piece-z') || '#f44336';
    PIECE_COLORS[PIECE_J] = getCssVar('--piece-j') || '#1565c0';
    PIECE_COLORS[PIECE_L] = getCssVar('--piece-l') || '#ef6c00';
  }

  // Each state is an array of [row, col] pairs within a 4x4 bounding box.
  // States: 0=spawn, 1=R(CW), 2=180, 3=L(CCW)
  const TETROMINOES = {
    [PIECE_I]: [
      [[1,0],[1,1],[1,2],[1,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,1],[1,1],[2,1],[3,1]],
    ],
    [PIECE_O]: [
      [[0,1],[0,2],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[1,2]],
    ],
    [PIECE_T]: [
      [[0,1],[1,0],[1,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,1]],
      [[1,0],[1,1],[1,2],[2,1]],
      [[0,1],[1,0],[1,1],[2,1]],
    ],
    [PIECE_S]: [
      [[0,1],[0,2],[1,0],[1,1]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,1],[1,2],[2,0],[2,1]],
      [[0,0],[1,0],[1,1],[2,1]],
    ],
    [PIECE_Z]: [
      [[0,0],[0,1],[1,1],[1,2]],
      [[0,2],[1,1],[1,2],[2,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[0,1],[1,0],[1,1],[2,0]],
    ],
    [PIECE_J]: [
      [[0,0],[1,0],[1,1],[1,2]],
      [[0,1],[0,2],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,0],[2,1]],
    ],
    [PIECE_L]: [
      [[0,2],[1,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[1,2],[2,0]],
      [[0,0],[0,1],[1,1],[2,1]],
    ],
  };

  // SRS wall-kick offset tables.
  // Key = "fromState>toState", value = array of [rowOffset, colOffset] tests.
  // Negative row = upward shift; positive col = rightward shift.
  const WALL_KICKS_JLSTZ = {
    '0>1': [[ 0, 0],[ 0,-1],[-1,-1],[ 2, 0],[ 2,-1]],
    '1>0': [[ 0, 0],[ 0, 1],[ 1, 1],[-2, 0],[-2, 1]],
    '1>2': [[ 0, 0],[ 0, 1],[ 1, 1],[-2, 0],[-2, 1]],
    '2>1': [[ 0, 0],[ 0,-1],[-1,-1],[ 2, 0],[ 2,-1]],
    '2>3': [[ 0, 0],[ 0, 1],[-1, 1],[ 2, 0],[ 2, 1]],
    '3>2': [[ 0, 0],[ 0,-1],[ 1,-1],[-2, 0],[-2,-1]],
    '3>0': [[ 0, 0],[ 0,-1],[ 1,-1],[-2, 0],[-2,-1]],
    '0>3': [[ 0, 0],[ 0, 1],[-1, 1],[ 2, 0],[ 2, 1]],
  };

  const WALL_KICKS_I = {
    '0>1': [[ 0, 0],[ 0,-2],[ 0, 1],[-1,-2],[ 2, 1]],
    '1>0': [[ 0, 0],[ 0, 2],[ 0,-1],[ 1, 2],[-2,-1]],
    '1>2': [[ 0, 0],[ 0,-1],[ 0, 2],[ 2,-1],[-1, 2]],
    '2>1': [[ 0, 0],[ 0, 1],[ 0,-2],[-2, 1],[ 1,-2]],
    '2>3': [[ 0, 0],[ 0, 2],[ 0,-1],[ 1, 2],[-2,-1]],
    '3>2': [[ 0, 0],[ 0,-2],[ 0, 1],[-1,-2],[ 2, 1]],
    '3>0': [[ 0, 0],[ 0, 1],[ 0,-2],[-2, 1],[ 1,-2]],
    '0>3': [[ 0, 0],[ 0,-1],[ 0, 2],[ 2,-1],[-1, 2]],
  };

  // Base line-clear scores (multiplied by level)
  const LINE_CLEAR_SCORES = { 0: 0, 1: 100, 2: 300, 3: 500, 4: 800 };

  // T-spin scores (multiplied by level)
  const T_SPIN_SCORES      = { 0: 400, 1: 800, 2: 1200, 3: 1600 };
  const T_SPIN_MINI_SCORES = { 0: 100, 1: 200 };

  const COMBO_BONUS_PER_COMBO      = 50;
  const SOFT_DROP_SCORE_PER_CELL   = 1;
  const HARD_DROP_SCORE_PER_CELL   = 2;
  const BACK_TO_BACK_MULTIPLIER    = 1.5;
  const LINES_PER_LEVEL            = 10;

  // Gravity ms-per-drop indexed by level (1-based), capped at index 14 for 15+
  const LEVEL_SPEEDS = [1000,793,618,473,355,262,190,135,94,64,43,28,18,11,7];

  const THEME_STORAGE_KEY = 'tetris-theme';

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════

  let dom = {};

  function cacheDom() {
    dom = {
      boardCanvas:      document.getElementById('canvas-board'),
      holdCanvas:       document.getElementById('canvas-hold'),
      nextCanvas:       document.getElementById('canvas-next'),
      hudScore:         document.getElementById('hud-score'),
      hudLevel:         document.getElementById('hud-level'),
      hudLines:         document.getElementById('hud-lines'),
      hudHighScore:     document.getElementById('hud-high-score'),
      actionText:       document.getElementById('action-text'),
      levelUpText:      document.getElementById('level-up-text'),
      screenStart:      document.getElementById('screen-start'),
      screenPause:      document.getElementById('screen-pause'),
      screenGameover:   document.getElementById('screen-gameover'),
      finalScore:       document.getElementById('final-score'),
      highScoreDisplay: document.getElementById('high-score-display'),
      btnStart:         document.getElementById('btn-start'),
      btnPlayAgain:     document.getElementById('btn-play-again'),
      btnChangeTheme:   document.getElementById('btn-change-theme'),
      themeCards:       document.querySelectorAll('.theme-card'),
    };
    dom.boardCtx = dom.boardCanvas.getContext('2d');
    dom.holdCtx  = dom.holdCanvas.getContext('2d');
    dom.nextCtx  = dom.nextCanvas.getContext('2d');
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: THEME MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Read a CSS custom property from the document root.
   * All canvas draw calls use this so theme changes are reflected immediately.
   */
  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function loadSavedTheme() {
    try { return localStorage.getItem(THEME_STORAGE_KEY) || 'dark'; }
    catch (_) { return 'dark'; }
  }

  function saveTheme(theme) {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); }
    catch (_) { /* storage unavailable */ }
  }

  /**
   * Apply theme to body and update theme card selected states.
   * Does NOT start or stop the game — pure visual application.
   */
  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    saveTheme(theme);

    dom.themeCards.forEach(card => {
      const isSelected = card.dataset.themeValue === theme;
      card.classList.toggle('theme-card--selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    });

    // THEME: reload piece colors from CSS vars after theme vars switch
    loadPieceColors();
  }

  function initThemeSelector() {
    dom.themeCards.forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.dataset.themeValue;
        applyTheme(theme);
        // Sync game state theme even before game starts
        state.theme = theme;
      });
    });

    dom.btnStart.addEventListener('click', () => startGame());

    dom.btnPlayAgain.addEventListener('click', () => startGame());

    dom.btnChangeTheme.addEventListener('click', () => {
      showScreen('screen-start');
      state.phase = 'start';
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: GAME STATE
  // ═══════════════════════════════════════════════════════════════

  let state = {};

  function buildEmptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function initState() {
    state = {
      board: buildEmptyBoard(),
      current: { type: 0, rotation: 0, x: 0, y: 0 },
      ghostY: 0,
      hold: { type: 0, locked: false },
      bag:  [],
      next: [],
      score:     0,
      highScore: loadHighScore(),
      level:     1,
      lines:     0,
      combo:     -1,
      backToBack: false,
      lockTimer:    0,
      lockResets:   0,
      isOnSurface:  false,
      gravityTimer: 0,
      das: {
        left:  { held: false, dasTimer: 0, arrTimer: 0, active: false },
        right: { held: false, dasTimer: 0, arrTimer: 0, active: false },
        down:  { held: false, arrTimer: 0 },
      },
      phase: 'playing',
      clearingRows:   [],
      clearAnimTimer: 0,
      lastWasRotation: false,
      lastKickIndex:   0,
      actionTextTimer: 0,
      levelUpTimer:    0,
      // Theme is read from body at render time; stored here for reference
      theme: document.body.dataset.theme || 'dark',
    };

    fillNextQueue();
    spawnPiece(drawFromQueue());
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5: 7-BAG RANDOMIZER
  // ═══════════════════════════════════════════════════════════════

  function shuffledBag() {
    const bag = [PIECE_I, PIECE_O, PIECE_T, PIECE_S, PIECE_Z, PIECE_J, PIECE_L];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  function fillNextQueue() {
    while (state.next.length < 6) {
      if (state.bag.length === 0) state.bag = shuffledBag();
      state.next.push(state.bag.pop());
    }
  }

  function drawFromQueue() {
    fillNextQueue();
    return state.next.shift();
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 6: COLLISION DETECTION
  // ═══════════════════════════════════════════════════════════════

  function getCells(type, rotation, x, y) {
    return TETROMINOES[type][rotation].map(([r, c]) => [y + r, x + c]);
  }

  function isValid(type, rotation, x, y) {
    const cells = getCells(type, rotation, x, y);
    for (const [r, c] of cells) {
      if (c < 0 || c >= COLS) return false;
      if (r >= ROWS)           return false;
      if (r >= 0 && state.board[r][c] !== 0) return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 7: SPAWNING & GHOST
  // ═══════════════════════════════════════════════════════════════

  function spawnPiece(type) {
    const spawnX = Math.floor((COLS - 4) / 2); // col 3 on 10-wide board
    const spawnY = 0;

    state.current        = { type, rotation: 0, x: spawnX, y: spawnY };
    state.lastWasRotation = false;
    state.lastKickIndex   = 0;
    state.lockTimer       = 0;
    state.lockResets      = 0;
    state.isOnSurface     = false;
    state.gravityTimer    = 0;
    state.hold.locked     = false;

    updateGhost();

    if (!isValid(type, 0, spawnX, spawnY)) {
      triggerGameOver();
      return false;
    }
    return true;
  }

  function updateGhost() {
    const { type, rotation, x, y } = state.current;
    let gy = y;
    while (isValid(type, rotation, x, gy + 1)) gy++;
    state.ghostY = gy;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 8: MOVEMENT
  // ═══════════════════════════════════════════════════════════════

  function movePiece(dx, dy) {
    const { type, rotation, x, y } = state.current;
    if (!isValid(type, rotation, x + dx, y + dy)) return false;

    state.current.x = x + dx;
    state.current.y = y + dy;
    state.lastWasRotation = false;

    // Lateral moves reset the lock timer (move-reset mechanic)
    if (dx !== 0 && state.isOnSurface && state.lockResets < MAX_LOCK_RESETS) {
      state.lockTimer  = 0;
      state.lockResets++;
    }

    updateGhost();
    return true;
  }

  function rotatePiece(dir) {
    const { type, rotation, x, y } = state.current;
    const newRot = ((rotation + dir) % 4 + 4) % 4;
    const kickKey = `${rotation}>${newRot}`;

    const kicks = (type === PIECE_I)
      ? WALL_KICKS_I[kickKey]
      : WALL_KICKS_JLSTZ[kickKey];

    if (!kicks) return false;

    for (let i = 0; i < kicks.length; i++) {
      const [dr, dc] = kicks[i];
      const nx = x + dc;
      const ny = y + dr;
      if (isValid(type, newRot, nx, ny)) {
        state.current.rotation = newRot;
        state.current.x        = nx;
        state.current.y        = ny;
        state.lastWasRotation  = true;
        state.lastKickIndex    = i;

        if (state.isOnSurface && state.lockResets < MAX_LOCK_RESETS) {
          state.lockTimer  = 0;
          state.lockResets++;
        }

        updateGhost();
        return true;
      }
    }
    return false;
  }

  function hardDrop() {
    const cellsDropped = state.ghostY - state.current.y;
    state.current.y = state.ghostY;
    state.score += HARD_DROP_SCORE_PER_CELL * cellsDropped;
    updateHud();
    lockPiece();
  }

  function softDropStep() {
    if (movePiece(0, 1)) {
      state.score += SOFT_DROP_SCORE_PER_CELL;
      state.gravityTimer = 0;
      updateHud();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 9: HOLD
  // ═══════════════════════════════════════════════════════════════

  function holdPiece() {
    if (state.hold.locked) return; // already held this turn

    const { type }   = state.current;
    const prevHold   = state.hold.type;
    state.hold.type   = type;
    state.hold.locked = true;

    const nextType = (prevHold === 0) ? drawFromQueue() : prevHold;
    spawnPiece(nextType);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 10: LOCKING & LINE CLEARS
  // ═══════════════════════════════════════════════════════════════

  function lockPiece() {
    const { type, rotation, x, y } = state.current;
    const cells = getCells(type, rotation, x, y);

    // FIX [A]: detectTSpin() must run BEFORE writing cells to board.
    const tSpinResult = detectTSpin();

    // FIX [C]: Reset all lock-delay state so the game loop cannot fire a second lockPiece().
    state.lockTimer   = 0;
    state.lockResets  = 0;
    state.isOnSurface = false;

    let allAboveVisible = true;
    for (const [r, c] of cells) {
      if (r >= 0 && r < ROWS) {
        state.board[r][c] = type;
        if (r >= 2) allAboveVisible = false;
      }
    }

    // Lock-out: piece locked entirely in hidden zone
    if (allAboveVisible) {
      triggerGameOver();
      return;
    }

    const fullRows = [];
    // FIX [B]: Only scan visible rows (2..ROWS-1).
    for (let r = 2; r < ROWS; r++) {
      if (state.board[r].every(cell => cell !== 0)) fullRows.push(r);
    }

    scoreForClear(fullRows.length, tSpinResult);

    if (fullRows.length > 0) {
      state.clearingRows   = fullRows;
      state.clearAnimTimer = CLEAR_ANIM_DURATION;
    } else {
      state.combo = -1; // break combo on no-clear
      spawnNext();
    }
  }

  function collapseRows(rows) {
    const sorted = [...rows].sort((a, b) => b - a);
    for (const r of sorted) {
      state.board.splice(r, 1);
      state.board.unshift(new Array(COLS).fill(0));
    }
  }

  function spawnNext() {
    fillNextQueue();
    spawnPiece(drawFromQueue());
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 11: T-SPIN DETECTION (3-corner rule)
  // ═══════════════════════════════════════════════════════════════

  function detectTSpin() {
    const { type, rotation, x, y } = state.current;
    if (type !== PIECE_T || !state.lastWasRotation) return null;

    const corners = [
      [y,   x  ],  // 0: top-left
      [y,   x+2],  // 1: top-right
      [y+2, x  ],  // 2: bottom-left
      [y+2, x+2],  // 3: bottom-right
    ];

    const occupied = corners.map(([r, c]) =>
      r < 0 || r >= ROWS || c < 0 || c >= COLS || state.board[r][c] !== 0
    );

    const filledCount = occupied.filter(Boolean).length;
    if (filledCount < 3) return null;

    const frontIndices = { 0:[0,1], 1:[1,3], 2:[2,3], 3:[0,2] }[rotation];
    const frontFilled  = frontIndices.filter(i => occupied[i]).length;

    if (frontFilled === 2) return { isTSpin: true, isMini: false };

    if (state.lastKickIndex > 0) return { isTSpin: true, isMini: true };

    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 12: SCORING
  // ═══════════════════════════════════════════════════════════════

  function scoreForClear(linesCleared, tSpinResult) {
    const lv          = state.level;
    const isTSpin     = !!(tSpinResult && tSpinResult.isTSpin);
    const isMini      = !!(tSpinResult && tSpinResult.isMini);
    const isTetris    = linesCleared === 4;
    const isB2BWorthy = isTetris || (isTSpin && !isMini && linesCleared > 0);

    let baseScore   = 0;
    let actionLabel = '';

    if (isTSpin && isMini) {
      baseScore   = (T_SPIN_MINI_SCORES[linesCleared] || 0) * lv;
      actionLabel = linesCleared > 0 ? 'T-SPIN MINI' : 'T-SPIN MINI';
    } else if (isTSpin) {
      baseScore   = (T_SPIN_SCORES[linesCleared] != null ? T_SPIN_SCORES[linesCleared] : T_SPIN_SCORES[0]) * lv;
      const labels = ['T-SPIN','T-SPIN SINGLE','T-SPIN DOUBLE','T-SPIN TRIPLE'];
      actionLabel = labels[linesCleared] || 'T-SPIN';
    } else {
      baseScore   = (LINE_CLEAR_SCORES[linesCleared] || 0) * lv;
      const clearLabels = ['','SINGLE','DOUBLE','TRIPLE','TETRIS!'];
      actionLabel = clearLabels[linesCleared] || '';
    }

    let b2bBonus = false;
    if (isB2BWorthy && state.backToBack && baseScore > 0) {
      baseScore = Math.floor(baseScore * BACK_TO_BACK_MULTIPLIER);
      b2bBonus  = true;
    }

    if (linesCleared > 0) state.backToBack = isB2BWorthy;

    let comboScore = 0;
    if (linesCleared > 0) {
      state.combo++;
      if (state.combo > 0) comboScore = COMBO_BONUS_PER_COMBO * state.combo * lv;
    }

    state.score += baseScore + comboScore;

    const notifParts = [];
    if (actionLabel)        notifParts.push(actionLabel);
    if (b2bBonus)           notifParts.push('BACK-TO-BACK!');
    if (state.combo >= 2)   notifParts.push(state.combo + 'x COMBO');

    if (notifParts.length > 0) {
      dom.actionText.textContent = notifParts.join('\n');
      state.actionTextTimer = 1800;
      dom.actionText.classList.add("is-visible");
    }

    advanceLevel(linesCleared);
    updateHud();
    updateHighScore();
  }

  function advanceLevel(linesCleared) {
    if (linesCleared === 0) return;
    const prevLevel  = state.level;
    state.lines     += linesCleared;
    const newLevel   = Math.floor(state.lines / LINES_PER_LEVEL) + 1;
    if (newLevel > prevLevel) {
      state.level = newLevel;
      dom.levelUpText.textContent = 'LEVEL ' + state.level + '!';
      state.levelUpTimer = 1500;
      dom.levelUpText.classList.add('is-visible');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 13: HIGH SCORE (localStorage)
  // ═══════════════════════════════════════════════════════════════

  function loadHighScore() {
    try { return parseInt(localStorage.getItem('tetris_highscore') || '0', 10); }
    catch (_) { return 0; }
  }

  function updateHighScore() {
    if (state.score > state.highScore) {
      state.highScore = state.score;
      try { localStorage.setItem('tetris_highscore', String(state.highScore)); }
      catch (_) { /* storage unavailable in some file:// contexts */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 14: INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════

  const keys = {};

  function onKeyDown(e) {
    const gameKeys = ['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' ',
                      'KeyX','KeyZ','KeyC','ShiftLeft','ShiftRight','Escape','KeyP','Enter'];
    if (gameKeys.includes(e.code)) e.preventDefault();

    if (keys[e.code]) return; // already held — DAS/ARR handles repeat
    keys[e.code] = true;

    const phase = state.phase;

    if (phase === 'start' || phase === 'gameover') {
      if (e.code === 'Enter') startGame();
      return;
    }
    if (phase === 'paused') {
      if (e.code === 'Escape' || e.code === 'KeyP') resumeGame();
      return;
    }
    if (phase !== 'playing') return;
    if (state.clearingRows.length > 0) return; // freeze during clear anim

    switch (e.code) {
      case 'ArrowLeft':
        state.das.left.held     = true;
        state.das.left.dasTimer = 0;
        state.das.left.arrTimer = 0;
        state.das.left.active   = false;
        movePiece(-1, 0);
        break;
      case 'ArrowRight':
        state.das.right.held     = true;
        state.das.right.dasTimer = 0;
        state.das.right.arrTimer = 0;
        state.das.right.active   = false;
        movePiece(1, 0);
        break;
      case 'ArrowDown':
        state.das.down.held     = true;
        state.das.down.arrTimer = 0;
        softDropStep();
        break;
      case 'ArrowUp':
      case 'KeyX':
        rotatePiece(1);
        break;
      case 'KeyZ':
        rotatePiece(-1);
        break;
      case ' ':
        hardDrop();
        break;
      case 'KeyC':
      case 'ShiftLeft':
      case 'ShiftRight':
        holdPiece();
        break;
      case 'Escape':
      case 'KeyP':
        pauseGame();
        break;
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
    if (e.code === 'ArrowLeft')  { state.das.left.held  = false; state.das.left.active  = false; }
    if (e.code === 'ArrowRight') { state.das.right.held = false; state.das.right.active = false; }
    if (e.code === 'ArrowDown')  { state.das.down.held  = false; }
  }

  function processDasArr(dt) {
    if (state.phase !== 'playing' || state.clearingRows.length > 0) return;

    function tickDir(dasState, moveFn) {
      if (!dasState.held) return;
      if (!dasState.active) {
        dasState.dasTimer += dt;
        if (dasState.dasTimer >= DAS_DELAY) {
          dasState.active   = true;
          dasState.arrTimer = ARR_DELAY; // fire immediately on ARR activation
        }
      } else {
        dasState.arrTimer += dt;
        while (dasState.arrTimer >= ARR_DELAY) {
          dasState.arrTimer -= ARR_DELAY;
          moveFn();
        }
      }
    }

    tickDir(state.das.left,  () => movePiece(-1, 0));
    tickDir(state.das.right, () => movePiece(1,  0));

    // Soft drop uses ARR rate, no DAS phase
    if (state.das.down.held) {
      state.das.down.arrTimer += dt;
      while (state.das.down.arrTimer >= ARR_DELAY) {
        state.das.down.arrTimer -= ARR_DELAY;
        softDropStep();
      }
    } else {
      state.das.down.arrTimer = 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 15: UPDATE (game loop logic)
  // ═══════════════════════════════════════════════════════════════

  function update(dt) {
    if (state.phase !== 'playing') return;

    // Tick notification text timers
    if (state.actionTextTimer > 0) {
      state.actionTextTimer -= dt;
      if (state.actionTextTimer <= 0) { dom.actionText.textContent = ''; dom.actionText.classList.remove('is-visible'); }
    }
    if (state.levelUpTimer > 0) {
      state.levelUpTimer -= dt;
      if (state.levelUpTimer <= 0) { dom.levelUpText.textContent = ''; dom.levelUpText.classList.remove('is-visible'); }
    }

    // During clear animation: countdown then collapse and spawn next
    if (state.clearingRows.length > 0) {
      state.clearAnimTimer -= dt;
      if (state.clearAnimTimer <= 0) {
        collapseRows(state.clearingRows);
        // FIX [D]: clearingRows is emptied BEFORE spawnNext().
        state.clearingRows   = [];
        state.clearAnimTimer = 0;
        spawnNext();
      }
      return; // no gravity or input while rows clear
    }

    processDasArr(dt);

    // Gravity
    const dropInterval = getLevelSpeed(state.level);
    state.gravityTimer += dt;
    while (state.gravityTimer >= dropInterval) {
      state.gravityTimer -= dropInterval;
      movePiece(0, 1);
    }

    // Lock delay
    const onSurface = !isValid(
      state.current.type, state.current.rotation,
      state.current.x,    state.current.y + 1
    );

    if (onSurface) {
      state.isOnSurface = true;
      state.lockTimer  += dt;
      if (state.lockTimer >= LOCK_DELAY || state.lockResets >= MAX_LOCK_RESETS) {
        lockPiece();
      }
    } else {
      state.isOnSurface = false;
      state.lockTimer   = 0;
    }
  }

  function getLevelSpeed(level) {
    return LEVEL_SPEEDS[Math.min(level - 1, LEVEL_SPEEDS.length - 1)];
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 16: RENDERING
  // All canvas draw calls read CSS variables via getCssVar() so that
  // the active theme is always reflected without any manual re-pass.
  // ═══════════════════════════════════════════════════════════════

  function drawCell(ctx, col, row, color, cellSize, offsetX, offsetY) {
    const x = offsetX + col * cellSize;
    const y = offsetY + row * cellSize;
    const s = cellSize;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);

    // Subtle inner bevel for depth
    // THEME: read bevel colors from CSS vars so they adapt to dark/bright theme
    ctx.fillStyle = getCssVar('--cell-bevel-light');
    ctx.fillRect(x, y, s, 2);
    ctx.fillRect(x, y, 2, s);

    ctx.fillStyle = getCssVar('--cell-bevel-shadow');
    ctx.fillRect(x + s - 2, y, 2, s);
    ctx.fillRect(x, y + s - 2, s, 2);
  }

  function renderBoard() {
    const ctx = dom.boardCtx;
    const W   = COLS         * CELL_SIZE;
    const H   = VISIBLE_ROWS * CELL_SIZE;

    // Read theme colors fresh on every frame — ensures theme switch is instant
    const bgColor   = getCssVar('--canvas-bg');
    const gridColor = getCssVar('--canvas-grid');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth   = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL_SIZE, 0); ctx.lineTo(c * CELL_SIZE, H); ctx.stroke();
    }
    for (let r = 0; r <= VISIBLE_ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL_SIZE); ctx.lineTo(W, r * CELL_SIZE); ctx.stroke();
    }

    // Locked cells (visible rows = board rows 2..21)
    for (let r = 0; r < VISIBLE_ROWS; r++) {
      const boardRow = r + (ROWS - VISIBLE_ROWS);
      for (let c = 0; c < COLS; c++) {
        const cell = state.board[boardRow][c];
        if (cell !== 0) {
          const isClearing = state.clearingRows.includes(boardRow);
          const color = isClearing ? flashColor(state.clearAnimTimer) : PIECE_COLORS[cell];
          drawCell(ctx, c, r, color, CELL_SIZE, 0, 0);
        }
      }
    }
  }

  function flashColor(timerMs) {
    // THEME: use --text-accent base color so flash reads on both dark (#fff) and bright (#000) themes
    const base  = getCssVar('--text-accent') || '#ffffff';
    // Parse hex to RGB for alpha compositing
    let r = 255, g = 255, b = 255;
    const hex = base.replace('#', '');
    if (hex.length === 6) {
      r = parseInt(hex.slice(0,2), 16);
      g = parseInt(hex.slice(2,4), 16);
      b = parseInt(hex.slice(4,6), 16);
    }
    const t     = timerMs / CLEAR_ANIM_DURATION;
    const alpha = (0.5 + 0.5 * t).toFixed(2);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function renderGhost() {
    const { type, rotation, x } = state.current;
    const cells = getCells(type, rotation, x, state.ghostY);
    const ctx   = dom.boardCtx;

    // Ghost color from CSS variable — switches automatically with theme
    const ghostColor = getCssVar('--ghost-color');

    for (const [r, c] of cells) {
      const visRow = r - (ROWS - VISIBLE_ROWS);
      if (visRow < 0 || visRow >= VISIBLE_ROWS) continue;

      ctx.fillStyle = ghostColor;
      ctx.fillRect(c * CELL_SIZE, visRow * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = PIECE_COLORS[type];
      ctx.lineWidth   = 1;
      ctx.strokeRect(c * CELL_SIZE + 0.5, visRow * CELL_SIZE + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
    }
  }

  function renderCurrentPiece() {
    if (state.phase !== 'playing') return;
    const { type, rotation, x, y } = state.current;
    const cells = getCells(type, rotation, x, y);
    const ctx   = dom.boardCtx;

    for (const [r, c] of cells) {
      const visRow = r - (ROWS - VISIBLE_ROWS);
      if (visRow < 0 || visRow >= VISIBLE_ROWS) continue;
      drawCell(ctx, c, visRow, PIECE_COLORS[type], CELL_SIZE, 0, 0);
    }
  }

  function renderPieceInPanel(ctx, type, canvasW, canvasH) {
    if (!type || type === 0) return;

    const cells = TETROMINOES[type][0];
    let minR = 4, maxR = 0, minC = 4, maxC = 0;
    for (const [r, c] of cells) {
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (c < minC) minC = c; if (c > maxC) maxC = c;
    }
    const pieceW = (maxC - minC + 1) * PANEL_CELL_SIZE;
    const pieceH = (maxR - minR + 1) * PANEL_CELL_SIZE;
    const offX   = Math.floor((canvasW - pieceW) / 2) - minC * PANEL_CELL_SIZE;
    const offY   = Math.floor((canvasH - pieceH) / 2) - minR * PANEL_CELL_SIZE;

    for (const [r, c] of cells) {
      drawCell(ctx, c, r, PIECE_COLORS[type], PANEL_CELL_SIZE, offX, offY);
    }
  }

  function renderHold() {
    const ctx = dom.holdCtx;
    const W   = dom.holdCanvas.width;
    const H   = dom.holdCanvas.height;

    ctx.fillStyle = getCssVar('--canvas-bg');
    ctx.fillRect(0, 0, W, H);

    if (state.hold.locked) ctx.globalAlpha = 0.45;
    renderPieceInPanel(ctx, state.hold.type, W, H);
    ctx.globalAlpha = 1.0;
  }

  function renderNext() {
    const ctx    = dom.nextCtx;
    const W      = dom.nextCanvas.width;
    const H      = dom.nextCanvas.height;
    const slotH  = Math.floor(H / 3);

    ctx.fillStyle = getCssVar('--canvas-bg');
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 3; i++) {
      const type = state.next[i];
      if (!type) continue;

      const cells = TETROMINOES[type][0];
      let minR = 4, maxR = 0, minC = 4, maxC = 0;
      for (const [r, c] of cells) {
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      }
      const pieceW = (maxC - minC + 1) * PANEL_CELL_SIZE;
      const pieceH = (maxR - minR + 1) * PANEL_CELL_SIZE;
      const offX   = Math.floor((W - pieceW) / 2) - minC * PANEL_CELL_SIZE;
      const offY   = i * slotH + Math.floor((slotH - pieceH) / 2) - minR * PANEL_CELL_SIZE;

      for (const [r, c] of cells) {
        drawCell(ctx, c, r, PIECE_COLORS[type], PANEL_CELL_SIZE, offX, offY);
      }
    }
  }

  function updateHud() {
    dom.hudScore.textContent     = state.score.toLocaleString();
    dom.hudLevel.textContent     = state.level;
    dom.hudLines.textContent     = state.lines;
    dom.hudHighScore.textContent = state.highScore.toLocaleString();
  }

  function render() {
    renderBoard();
    if (state.phase === 'playing' || state.phase === 'paused') {
      renderGhost();
      renderCurrentPiece();
    }
    renderHold();
    renderNext();
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 17: SCREEN / PHASE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  function showScreen(id) {
    [dom.screenStart, dom.screenPause, dom.screenGameover].forEach(el => {
      el.classList.remove('screen--active');
    });
    if (id) document.getElementById(id).classList.add('screen--active');
  }

  function startGame() {
    // Lock in the currently selected theme before game starts
    state.theme = document.body.dataset.theme || 'dark';
    initState();
    state.theme = document.body.dataset.theme || 'dark'; // re-apply after initState reset
    showScreen(null);
    state.phase = 'playing';
    updateHud();
    dom.highScoreDisplay.textContent = state.highScore.toLocaleString();
    dom.hudHighScore.textContent     = state.highScore.toLocaleString();
  }

  function pauseGame() {
    if (state.phase !== 'playing') return;
    state.phase = 'paused';
    showScreen('screen-pause');
  }

  function resumeGame() {
    if (state.phase !== 'paused') return;
    state.phase   = 'playing';
    lastTimestamp = null; // prevent a large dt spike after unpause
    showScreen(null);
  }

  function triggerGameOver() {
    state.phase = 'gameover';
    updateHighScore();
    dom.finalScore.textContent       = state.score.toLocaleString();
    dom.highScoreDisplay.textContent = state.highScore.toLocaleString();
    showScreen('screen-gameover');
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 18: GAME LOOP
  // ═══════════════════════════════════════════════════════════════

  let lastTimestamp = null;

  function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    if (lastTimestamp === null) lastTimestamp = timestamp;

    // Cap dt at 100ms to absorb tab-switch / debugger pauses gracefully
    const dt = Math.min(timestamp - lastTimestamp, 100);
    lastTimestamp = timestamp;

    update(dt);
    render();
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 19: CANVAS SIZING
  // ═══════════════════════════════════════════════════════════════

  function resizeCanvases() {
    const boardW = COLS         * CELL_SIZE;
    const boardH = VISIBLE_ROWS * CELL_SIZE;
    dom.boardCanvas.width        = boardW;
    dom.boardCanvas.height       = boardH;
    dom.boardCanvas.style.width  = boardW + 'px';
    dom.boardCanvas.style.height = boardH + 'px';
    // hold (120×120) and next (120×360) sizes are set in HTML attributes
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 20: INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  function init() {
    cacheDom();
    resizeCanvases();

    // Restore last theme from localStorage and apply it
    const savedTheme = loadSavedTheme();
    applyTheme(savedTheme);

    // THEME: seed piece colors from CSS vars on startup
    loadPieceColors();

    // Wire up theme selector and game buttons
    initThemeSelector();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   onKeyUp);

    // Show start screen overlay
    showScreen('screen-start');
    state.phase = 'start';

    // Pre-initialise state so the background renders on first frame
    initState();
    state.phase = 'start';

    lastTimestamp = null;
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('DOMContentLoaded', init);

})();
