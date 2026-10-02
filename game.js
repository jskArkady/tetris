/**
 * game.js — Tetris Web Game
 *
 * Single IIFE. No ES modules (file:// compatible).
 * Uses an rAF loop, a single state object, and Canvas rendering.
 */
(function () {
  'use strict';

  const GameEngine = window.TetrisGameEngine;
  const Input = window.TetrisInput;
  const VisualEffects = window.TetrisEffects;
  const ThemeOptions = window.TetrisThemeOptions;
  const { ACTIONS } = GameEngine;

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: CONSTANTS
  // All magic numbers live here. Never use raw literals in logic.
  // ═══════════════════════════════════════════════════════════════

  const COLS = 10;
  const ROWS = 22;           // 20 visible + 2 hidden rows above playfield
  const VISIBLE_ROWS = 20;
  const HIDDEN_ROWS = ROWS - VISIBLE_ROWS;
  const CELL_SIZE = 30;      // pixels per cell on the main board canvas
  const EFFECT_MARGIN = CELL_SIZE; // one cell of room for shards outside the board

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
   * Load piece colors from CSS vars so future per-theme palettes are picked up
   * without touching JS. Falls back to hardcoded defaults when CSS vars are not
   * available, such as in unit-test environments.
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
  const STYLE_STORAGE_KEY = 'tetris-style-preset';
  const HIGH_SCORE_STORAGE_KEY = 'tetris_highscore';
  const DEFAULT_STYLE = 'impact';

  const REPEATING_ACTIONS = new Set([
    ACTIONS.MOVE_LEFT,
    ACTIONS.MOVE_RIGHT,
    ACTIONS.SOFT_DROP,
  ]);

  const PIECE_NAMES = {
    [PIECE_I]: 'I',
    [PIECE_O]: 'O',
    [PIECE_T]: 'T',
    [PIECE_S]: 'S',
    [PIECE_Z]: 'Z',
    [PIECE_J]: 'J',
    [PIECE_L]: 'L',
  };

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: DOM REFERENCES
  // ═══════════════════════════════════════════════════════════════

  let dom = {};
  let optionsReturnState = { screenId: 'screen-start', phase: 'start' };
  let themeCardsRendered = false;
  let lastFocusedElement = null;
  let activeScreen = null;
  let inputController = null;
  let renderDirty = true;
  let prefersReducedMotion = false;
  let canvasTheme = {
    background: '#09111d',
    grid: 'rgba(255, 255, 255, 0.08)',
    bevelLight: 'rgba(255, 255, 255, 0.26)',
    bevelShadow: 'rgba(0, 0, 0, 0.34)',
    cellOutline: 'rgba(255, 255, 255, 0.18)',
    ghost: 'rgba(255, 255, 255, 0.12)',
    ghostOutline: 'rgba(255, 255, 255, 0.54)',
    textAccent: '#ffffff',
    impactColor: '#44dff5',
    rewardColor: '#ffd778',
    enamel: false,
  };

  function cacheDom() {
    dom = {
      gameContainer:     document.getElementById('game-container'),
      boardWrapper:     document.getElementById('board-wrapper'),
      boardCanvas:      document.getElementById('canvas-board'),
      effectsCanvas:    document.getElementById('canvas-effects'),
      holdCanvas:       document.getElementById('canvas-hold'),
      nextCanvas:       document.getElementById('canvas-next'),
      hudScore:         document.getElementById('hud-score'),
      hudLevel:         document.getElementById('hud-level'),
      hudLines:         document.getElementById('hud-lines'),
      hudHighScore:     document.getElementById('hud-high-score'),
      actionText:       document.getElementById('action-text'),
      actionTextHeadline: document.getElementById('action-text-headline'),
      actionTextDetail: document.getElementById('action-text-detail'),
      levelUpText:      document.getElementById('level-up-text'),
      gameStatus:       document.getElementById('game-status'),
      screenStart:      document.getElementById('screen-start'),
      screenOptions:    document.getElementById('screen-options'),
      screenPause:      document.getElementById('screen-pause'),
      screenGameover:   document.getElementById('screen-gameover'),
      finalScore:       document.getElementById('final-score'),
      highScoreDisplay: document.getElementById('high-score-display'),
      menuAppearanceSummary: document.getElementById('menu-appearance-summary'),
      optionsSubtitle:  document.getElementById('options-subtitle'),
      optionsModeTitle:  document.getElementById('options-mode-title'),
      optionsModeCopy:   document.getElementById('options-mode-copy'),
      optionsThemesTitle: document.getElementById('options-themes-title'),
      optionsThemesCopy: document.getElementById('options-themes-copy'),
      presetGrid:       document.getElementById('preset-grid'),
      btnStart:         document.getElementById('btn-start'),
      btnOpenOptions:   document.getElementById('btn-open-options'),
      btnOptionsBack:   document.getElementById('btn-options-back'),
      btnResume:        document.getElementById('btn-resume'),
      btnPlayAgain:     document.getElementById('btn-play-again'),
      btnOpenOptionsGameover: document.getElementById('btn-open-options-gameover'),
      modeButtons:      document.querySelectorAll('.mode-chip'),
      gameControlButtons: document.querySelectorAll('[data-game-action]'),
    };
    dom.boardCtx = dom.boardCanvas.getContext('2d');
    dom.effectsCtx = dom.effectsCanvas.getContext('2d');
    dom.holdCtx  = dom.holdCanvas.getContext('2d');
    dom.nextCtx  = dom.nextCanvas.getContext('2d');
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: THEME MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  function getThemeRoot() {
    return document.documentElement;
  }

  function normalizeTheme(theme) {
    return theme === 'bright' ? 'bright' : 'dark';
  }

  function normalizeStyle(style) {
    return GameEngine.normalizeStyle(
      style,
      ThemeOptions && ThemeOptions.STYLE_OPTION_CONFIG,
      DEFAULT_STYLE
    );
  }

  function getActiveTheme() {
    return normalizeTheme(
      getThemeRoot().dataset.theme
      || (document.body && document.body.dataset.theme)
      || 'dark'
    );
  }

  function getActiveStyle() {
    return normalizeStyle(
      getThemeRoot().dataset.style
      || (document.body && document.body.dataset.style)
      || DEFAULT_STYLE
    );
  }

  /**
   * Read a CSS custom property from the active theme host.
   * Canvas rendering depends on this, so the host must match where the
   * theme tokens are actually defined.
   */
  function getCssVar(name) {
    const rootValue = getComputedStyle(getThemeRoot()).getPropertyValue(name).trim();
    if (rootValue) return rootValue;
    if (document.body) {
      return getComputedStyle(document.body).getPropertyValue(name).trim();
    }
    return '';
  }

  function markRenderDirty() {
    renderDirty = true;
  }

  function loadCanvasTheme() {
    canvasTheme = {
      background: getCssVar('--canvas-bg') || '#09111d',
      grid: getCssVar('--canvas-grid') || 'rgba(255, 255, 255, 0.08)',
      bevelLight: getCssVar('--cell-bevel-light') || 'rgba(255, 255, 255, 0.26)',
      bevelShadow: getCssVar('--cell-bevel-shadow') || 'rgba(0, 0, 0, 0.34)',
      cellOutline: getCssVar('--cell-outline') || 'rgba(255, 255, 255, 0.18)',
      ghost: getCssVar('--ghost-color') || 'rgba(255, 255, 255, 0.12)',
      ghostOutline: getCssVar('--ghost-outline') || 'rgba(255, 255, 255, 0.54)',
      textAccent: getCssVar('--text-accent') || '#ffffff',
      impactColor: getCssVar('--impact-color') || getCssVar('--text-accent') || '#ffffff',
      rewardColor: getCssVar('--reward-color') || getCssVar('--text-accent') || '#ffffff',
      enamel: getActiveStyle() === 'impact',
    };
  }

  function loadFromStorage(key, fallbackValue) {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue || fallbackValue;
    } catch (_) {
      return fallbackValue;
    }
  }

  function saveToStorage(key, value) {
    try { localStorage.setItem(key, String(value)); }
    catch (_) { /* storage unavailable */ }
  }

  function loadSavedTheme() {
    return normalizeTheme(loadFromStorage(THEME_STORAGE_KEY, 'dark'));
  }

  function saveTheme(theme) {
    saveToStorage(THEME_STORAGE_KEY, normalizeTheme(theme));
  }

  function loadSavedStyle() {
    return normalizeStyle(loadFromStorage(STYLE_STORAGE_KEY, DEFAULT_STYLE));
  }

  function saveStyle(style) {
    saveToStorage(STYLE_STORAGE_KEY, normalizeStyle(style));
  }

  function renderThemeCards(theme, style) {
    themeCardsRendered = true;
    dom.presetGrid.innerHTML = ThemeOptions.buildThemeCardsMarkup(theme, style);
  }

  function applyOptionsCopy() {
    const copy = ThemeOptions && ThemeOptions.OPTIONS_PANEL_COPY;
    if (!copy) return;

    dom.optionsSubtitle.textContent = copy.subtitle;
    dom.optionsModeTitle.textContent = copy.modeTitle;
    dom.optionsModeCopy.textContent = copy.modeCopy;
    dom.optionsThemesTitle.textContent = copy.themesTitle;
    dom.optionsThemesCopy.textContent = copy.themesCopy;
  }

  function syncThemeCardSelection(style) {
    dom.presetGrid.querySelectorAll('.preset-card').forEach(card => {
      const isSelected = card.dataset.styleValue === style;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function ensureThemeCards(theme, style) {
    if (!themeCardsRendered) {
      renderThemeCards(theme, style);
    }
  }

  function updateAppearanceUi(theme, style) {
    ensureThemeCards(theme, style);
    syncThemeCardSelection(style);

    dom.modeButtons.forEach(button => {
      const isSelected = button.dataset.modeValue === theme;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    dom.menuAppearanceSummary.textContent = ThemeOptions.buildAppearanceSummaryLabel(style, theme);
  }

  /**
   * Apply appearance tokens to the document root and keep body in sync for
   * compatibility. This is a pure visual update and does not affect gameplay.
   */
  function applyAppearance(theme, style) {
    const nextTheme = normalizeTheme(theme);
    const nextStyle = normalizeStyle(style);

    getThemeRoot().dataset.theme = nextTheme;
    getThemeRoot().dataset.style = nextStyle;
    if (document.body) {
      document.body.dataset.theme = nextTheme;
      document.body.dataset.style = nextStyle;
    }

    saveTheme(nextTheme);
    saveStyle(nextStyle);
    updateAppearanceUi(nextTheme, nextStyle);

    // Reload piece colors after the active appearance variables change.
    loadPieceColors();
    loadCanvasTheme();
    markRenderDirty();

    if (state.effects && !prefersReducedMotion) {
      VisualEffects.triggerAppearanceMorph(state.effects);
    }
  }

  function openOptionsScreen(screenId, phase) {
    lastFocusedElement = document.activeElement || null;
    optionsReturnState = { screenId, phase };
    showScreen('screen-options');
    state.phase = 'options';
  }

  function closeOptionsScreen() {
    showScreen(optionsReturnState.screenId);
    state.phase = optionsReturnState.phase;
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function initAppearanceControls() {
    dom.modeButtons.forEach(button => {
      button.addEventListener('click', () => {
        applyAppearance(button.dataset.modeValue, getActiveStyle());
      });
    });

    dom.presetGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.preset-card');
      if (!card) return;
      applyAppearance(getActiveTheme(), card.dataset.styleValue);
    });

    dom.btnStart.addEventListener('click', () => startGame());
    dom.btnOpenOptions.addEventListener('click', () => openOptionsScreen('screen-start', 'start'));
    dom.btnOptionsBack.addEventListener('click', () => closeOptionsScreen());
    dom.btnResume.addEventListener('click', () => resumeGame());

    dom.btnPlayAgain.addEventListener('click', () => startGame());
    dom.btnOpenOptionsGameover.addEventListener('click', () => {
      openOptionsScreen('screen-gameover', 'gameover');
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: GAME STATE
  // ═══════════════════════════════════════════════════════════════

  let state = {};

  function buildEmptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function initState(announceSpawn = true) {
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
      pendingHardDrop: null,
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
      lastAction:       'spawn',
      lastKickIndex:   0,
      actionTextTimer: 0,
      levelUpTimer:    0,
      effects: VisualEffects.createVisualEffectsState(),
    };

    fillNextQueue();
    spawnPiece(drawFromQueue(), announceSpawn);
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

  function spawnPiece(type, announce = true) {
    const spawnX = Math.floor((COLS - 4) / 2); // col 3 on 10-wide board
    const spawnY = GameEngine.getSpawnY(ROWS, VISIBLE_ROWS);

    state.current        = { type, rotation: 0, x: spawnX, y: spawnY };
    state.lastAction      = 'spawn';
    state.lastKickIndex   = 0;
    state.lockTimer       = 0;
    state.lockResets      = 0;
    state.isOnSurface     = false;
    state.gravityTimer    = 0;

    updateGhost();

    if (!isValid(type, 0, spawnX, spawnY)) {
      triggerGameOver();
      return false;
    }
    if (announce) announceGameStatus(`${PIECE_NAMES[type]} piece active.`);
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
    state.lastAction = 'move';

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
        state.lastAction       = 'rotate';
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
    const fromRow = state.current.y;
    const cellsDropped = state.ghostY - state.current.y;
    state.current.y = state.ghostY;
    if (cellsDropped > 0) state.lastAction = 'hard-drop';
    state.pendingHardDrop = { fromRow, toRow: state.ghostY };
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
    announceGameStatus(
      `${PIECE_NAMES[type]} piece held. ${PIECE_NAMES[nextType]} piece active.`
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 10: LOCKING & LINE CLEARS
  // ═══════════════════════════════════════════════════════════════

  function lockPiece() {
    const { type, rotation, x, y } = state.current;
    const cells = getCells(type, rotation, x, y);

    // T-spin detection depends on the board state before this piece is written.
    const tSpinResult = detectTSpin();

    // Reset lock-delay state so the game loop cannot lock the same piece twice.
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
    // Hidden rows do not participate in line clears.
    for (let r = 2; r < ROWS; r++) {
      if (state.board[r].every(cell => cell !== 0)) fullRows.push(r);
    }

    if (state.pendingHardDrop && !prefersReducedMotion) {
      VisualEffects.triggerHardDropImpact(
        state.effects,
        state.pendingHardDrop.fromRow,
        state.pendingHardDrop.toRow,
        cells,
        type
      );
    }
    state.pendingHardDrop = null;

    scoreForClear(fullRows.length, tSpinResult);

    if (fullRows.length > 0) {
      state.clearingRows   = fullRows;
      state.clearAnimTimer = prefersReducedMotion ? 0 : CLEAR_ANIM_DURATION;
      if (!prefersReducedMotion) {
        VisualEffects.triggerLineClearSweep(state.effects, fullRows, state.board, state.combo);
      }
      announceGameStatus(`${fullRows.length} line${fullRows.length === 1 ? '' : 's'} cleared.`);
    } else {
      state.combo = -1; // break combo on no-clear
      spawnNext();
    }
  }

  function collapseRows(rows) {
    const rowsToClear = new Set(rows);
    const remainingRows = state.board.filter((_, rowIndex) => !rowsToClear.has(rowIndex));
    const clearedCount = state.board.length - remainingRows.length;

    // Rebuild the board in one pass. Repeated splice()+unshift() mutates row
    // indices mid-loop, which can skip or preserve rows during 2+ line clears.
    const rebuiltBoard = Array.from(
      { length: clearedCount },
      () => new Array(COLS).fill(0)
    ).concat(remainingRows);

    state.board = rebuiltBoard;
  }

  function spawnNext() {
    state.hold.locked = false;
    spawnPiece(drawFromQueue());
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 11: T-SPIN DETECTION (3-corner rule)
  // ═══════════════════════════════════════════════════════════════

  function detectTSpin() {
    const { type, rotation, x, y } = state.current;
    if (type !== PIECE_T) return null;

    const corners = [
      [y,   x  ],  // 0: top-left
      [y,   x+2],  // 1: top-right
      [y+2, x  ],  // 2: bottom-left
      [y+2, x+2],  // 3: bottom-right
    ];

    const occupied = corners.map(([r, c]) =>
      r < 0 || r >= ROWS || c < 0 || c >= COLS || state.board[r][c] !== 0
    );

    return GameEngine.classifyTSpin({
      occupiedCorners: occupied,
      rotation,
      lastAction: state.lastAction,
      kickIndex: state.lastKickIndex,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 12: SCORING
  // ═══════════════════════════════════════════════════════════════

  function scoreForClear(linesCleared, tSpinResult) {
    const lv          = state.level;
    const isTSpin     = !!(tSpinResult && tSpinResult.isTSpin);
    const isMini      = !!(tSpinResult && tSpinResult.isMini);
    const isTetris    = linesCleared === 4;
    const isB2BWorthy = GameEngine.isBackToBackWorthy({
      linesCleared,
      isTSpin,
      isTetris,
    });

    let baseScore   = 0;
    let actionLabel = '';

    if (isTSpin && isMini) {
      baseScore   = (T_SPIN_MINI_SCORES[linesCleared] || 0) * lv;
      actionLabel = 'T-SPIN MINI';
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

    const notification = VisualEffects.buildActionNotification({
      actionLabel,
      b2bBonus,
      combo: state.combo,
      linesCleared,
    });

    if (notification.headline || notification.detail) {
      showActionNotification(notification);
    }

    advanceLevel(linesCleared);
    updateHud();
    updateHighScore();
  }

  function showActionNotification(notification) {
    dom.actionTextHeadline.textContent = notification.headline;
    dom.actionTextDetail.textContent = notification.detail;
    dom.actionText.className = `action-text action-text--${notification.tone} is-visible`;
    state.actionTextTimer = notification.durationMs;
  }

  function advanceLevel(linesCleared) {
    if (linesCleared === 0) return;
    const prevLevel  = state.level;
    state.lines     += linesCleared;
    const newLevel   = Math.floor(state.lines / LINES_PER_LEVEL) + 1;
    if (newLevel > prevLevel) {
      state.level = newLevel;
      const levelNotification = VisualEffects.buildLevelUpNotification(state.level);
      dom.levelUpText.textContent = levelNotification.headline;
      dom.levelUpText.className = `level-up-text level-up-text--${levelNotification.tone} is-visible`;
      state.levelUpTimer = levelNotification.durationMs;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 13: HIGH SCORE (localStorage)
  // ═══════════════════════════════════════════════════════════════

  function loadHighScore() {
    const storedValue = loadFromStorage(HIGH_SCORE_STORAGE_KEY, '0');
    const normalizedValue = GameEngine.normalizeHighScore(storedValue);
    if (String(normalizedValue) !== String(storedValue)) {
      saveToStorage(HIGH_SCORE_STORAGE_KEY, normalizedValue);
    }
    return normalizedValue;
  }

  function updateHighScore() {
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveToStorage(HIGH_SCORE_STORAGE_KEY, state.highScore);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 14: INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════

  function beginRepeatingAction(action, moveImmediately = true) {
    if (action === ACTIONS.MOVE_LEFT) {
      state.das.left.held = true;
      state.das.left.dasTimer = 0;
      state.das.left.arrTimer = 0;
      state.das.left.active = false;
      if (moveImmediately) movePiece(-1, 0);
    } else if (action === ACTIONS.MOVE_RIGHT) {
      state.das.right.held = true;
      state.das.right.dasTimer = 0;
      state.das.right.arrTimer = 0;
      state.das.right.active = false;
      if (moveImmediately) movePiece(1, 0);
    } else if (action === ACTIONS.SOFT_DROP) {
      state.das.down.held = true;
      state.das.down.arrTimer = 0;
      if (moveImmediately) softDropStep();
    }
  }

  function endRepeatingAction(action) {
    if (!state.das) return;
    if (action === ACTIONS.MOVE_LEFT) {
      state.das.left.held = false;
      state.das.left.active = false;
    } else if (action === ACTIONS.MOVE_RIGHT) {
      state.das.right.held = false;
      state.das.right.active = false;
    } else if (action === ACTIONS.SOFT_DROP) {
      state.das.down.held = false;
    }
  }

  function resetInputState() {
    if (inputController) inputController.reset();
    if (!state.das) return;
    state.das.left.dasTimer = 0;
    state.das.left.arrTimer = 0;
    state.das.right.dasTimer = 0;
    state.das.right.arrTimer = 0;
    state.das.down.arrTimer = 0;
  }

  function dispatchGameAction(action, startRepeat = false) {
    const phase = state.phase;

    if (phase === 'start' || phase === 'gameover') {
      if (action === ACTIONS.START) {
        startGame();
        return true;
      }
      return false;
    }
    if (phase === 'paused') {
      if (action === ACTIONS.PAUSE) {
        resumeGame();
        return true;
      }
      return false;
    }
    if (phase === 'options') {
      if (action === ACTIONS.PAUSE) {
        closeOptionsScreen();
        return true;
      }
      return false;
    }
    if (phase !== 'playing') return false;

    if (action === ACTIONS.PAUSE) {
      pauseGame();
      return true;
    }

    if (state.clearingRows.length > 0) {
      // Preserve held input without moving the already locked piece. Repeats
      // resume after the clear; releasing during the animation still cancels.
      if (startRepeat && REPEATING_ACTIONS.has(action)) beginRepeatingAction(action, false);
      return true;
    }

    if (REPEATING_ACTIONS.has(action)) {
      if (startRepeat) beginRepeatingAction(action);
      else if (action === ACTIONS.MOVE_LEFT) movePiece(-1, 0);
      else if (action === ACTIONS.MOVE_RIGHT) movePiece(1, 0);
      else softDropStep();
      return true;
    }

    switch (action) {
      case ACTIONS.ROTATE_CW:
        rotatePiece(1);
        return true;
      case ACTIONS.ROTATE_CCW:
        rotatePiece(-1);
        return true;
      case ACTIONS.HARD_DROP:
        hardDrop();
        return true;
      case ACTIONS.HOLD:
        holdPiece();
        return true;
      default:
        return false;
    }
  }

  function trapScreenFocus(event) {
    if (!activeScreen || typeof activeScreen.querySelectorAll !== 'function') return false;
    const focusable = Array.from(activeScreen.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return false;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && (activeElement === first || !activeScreen.contains(activeElement))) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && (activeElement === last || !activeScreen.contains(activeElement))) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
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
    if (state.phase !== 'paused') VisualEffects.tickVisualEffects(state.effects, dt);

    if (state.phase !== 'playing') return;

    // Tick notification text timers
    if (state.actionTextTimer > 0) {
      state.actionTextTimer -= dt;
      if (state.actionTextTimer <= 0) {
        dom.actionTextHeadline.textContent = '';
        dom.actionTextDetail.textContent = '';
        dom.actionText.className = 'action-text';
      }
    }
    if (state.levelUpTimer > 0) {
      state.levelUpTimer -= dt;
      if (state.levelUpTimer <= 0) {
        dom.levelUpText.textContent = '';
        dom.levelUpText.className = 'level-up-text';
      }
    }

    // During clear animation: countdown then collapse and spawn next
    if (state.clearingRows.length > 0) {
      state.clearAnimTimer -= dt;
      if (state.clearAnimTimer <= 0) {
        collapseRows(state.clearingRows);
        // Clear this transition state before spawning the next piece.
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

    ctx.fillStyle = canvasTheme.bevelLight;
    ctx.fillRect(x, y, s, 2);
    ctx.fillRect(x, y, 2, s);

    ctx.fillStyle = canvasTheme.bevelShadow;
    ctx.fillRect(x + s - 2, y, 2, s);
    ctx.fillRect(x, y + s - 2, s, 2);

    ctx.strokeStyle = canvasTheme.cellOutline;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);

    if (canvasTheme.enamel) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(x + 4, y + 4, s - 8, Math.max(2, s * 0.14));
      ctx.strokeStyle = canvasTheme.bevelShadow;
      ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    }
  }

  function renderBoard() {
    const ctx = dom.boardCtx;
    const W   = COLS         * CELL_SIZE;
    const H   = VISIBLE_ROWS * CELL_SIZE;

    const bgColor   = canvasTheme.background;
    const gridColor = canvasTheme.grid;

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
      const boardRow = r + HIDDEN_ROWS;
      for (let c = 0; c < COLS; c++) {
        const cell = state.board[boardRow][c];
        if (cell !== 0) {
          drawCell(ctx, c, r, PIECE_COLORS[cell], CELL_SIZE, 0, 0);
        }
      }
    }
  }

  function renderGhost() {
    const { type, rotation, x } = state.current;
    const cells = getCells(type, rotation, x, state.ghostY);
    const ctx   = dom.boardCtx;

    // Ghost color from CSS variable — switches automatically with theme
    const ghostColor = canvasTheme.ghost;

    for (const [r, c] of cells) {
      const visRow = r - HIDDEN_ROWS;
      if (visRow < 0 || visRow >= VISIBLE_ROWS) continue;

      ctx.fillStyle = ghostColor;
      ctx.fillRect(c * CELL_SIZE, visRow * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = canvasTheme.ghostOutline;
      ctx.lineWidth   = canvasTheme.enamel ? 1.5 : 2;
      ctx.strokeRect(c * CELL_SIZE + 1, visRow * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  function renderCurrentPiece() {
    if (state.phase !== 'playing' && state.phase !== 'paused') return;
    const { type, rotation, x, y } = state.current;
    const cells = getCells(type, rotation, x, y);
    const ctx   = dom.boardCtx;

    for (const [r, c] of cells) {
      const visRow = r - HIDDEN_ROWS;
      if (visRow < 0 || visRow >= VISIBLE_ROWS) continue;
      drawCell(ctx, c, visRow, PIECE_COLORS[type], CELL_SIZE, 0, 0);
      if (canvasTheme.enamel) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(c * CELL_SIZE + 3, visRow * CELL_SIZE + 2, CELL_SIZE - 6, 2);
      }
    }
  }

  function renderEffectParticles(ctx, effect) {
    for (const particle of VisualEffects.getParticleVisuals(effect)) {
      const x = EFFECT_MARGIN + particle.col * CELL_SIZE;
      const y = EFFECT_MARGIN + (particle.row - HIDDEN_ROWS) * CELL_SIZE;
      const size = particle.size * CELL_SIZE;
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = PIECE_COLORS[particle.pieceType] || canvasTheme.impactColor;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.fillStyle = canvasTheme.bevelLight;
      ctx.fillRect(x - size / 2, y - size / 2, size, 1);
    }
  }

  function renderEffects() {
    const ctx = dom.effectsCtx;
    ctx.clearRect(0, 0, dom.effectsCanvas.width, dom.effectsCanvas.height);
    if (prefersReducedMotion) return;
    ctx.save();

    const drop = state.effects.hardDrop;
    if (drop) {
      const decay = 1 - drop.elapsedMs / drop.durationMs;
      ctx.fillStyle = PIECE_COLORS[drop.pieceType] || canvasTheme.impactColor;
      const distance = drop.toRow - drop.fromRow;
      const columns = new Map();
      for (const [row, col] of drop.cells) {
        columns.set(col, Math.max(columns.get(col) ?? -Infinity, row));
      }
      for (const [col, row] of columns) {
        const x = EFFECT_MARGIN + col * CELL_SIZE;
        const endY = (row + 1 - HIDDEN_ROWS) * CELL_SIZE;
        const startY = Math.max(0, (row - distance - HIDDEN_ROWS) * CELL_SIZE);
        ctx.globalAlpha = decay * 0.12;
        ctx.fillRect(x + CELL_SIZE * 0.35, EFFECT_MARGIN + startY,
          CELL_SIZE * 0.3, Math.max(0, endY - startY));
        ctx.globalAlpha = decay * 0.9;
        ctx.fillRect(x + 1, EFFECT_MARGIN + endY - 2, CELL_SIZE - 2, 3);
      }
      renderEffectParticles(ctx, drop);
    }

    const clear = state.effects.lineClear;
    if (clear) {
      const progress = clear.elapsedMs / clear.durationMs;
      const decay = Math.pow(1 - progress, 2);
      ctx.fillStyle = clear.rows.length === 4 ? canvasTheme.rewardColor : canvasTheme.impactColor;
      for (const { row, cells } of clear.snapshots) {
        const y = EFFECT_MARGIN + (row - HIDDEN_ROWS) * CELL_SIZE;
        ctx.globalAlpha = decay * 0.16;
        // Use the pre-collapse width; never sample a newly spawned piece or board.
        ctx.fillRect(EFFECT_MARGIN, y, cells.length * CELL_SIZE, CELL_SIZE);
        ctx.globalAlpha = decay * clear.strength;
        ctx.fillRect(EFFECT_MARGIN - 8 * progress, y + CELL_SIZE / 2 - 1,
          cells.length * CELL_SIZE + 16 * progress, 2);
      }
      renderEffectParticles(ctx, clear);
    }
    ctx.restore();
  }

  function renderPieceInPanel(ctx, type, panelWidth, panelHeight, panelTop = 0) {
    if (!type) return;

    const cells = TETROMINOES[type][0];
    let minR = 4, maxR = 0, minC = 4, maxC = 0;
    for (const [r, c] of cells) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    const pieceW = (maxC - minC + 1) * PANEL_CELL_SIZE;
    const pieceH = (maxR - minR + 1) * PANEL_CELL_SIZE;
    const offX   = Math.floor((panelWidth - pieceW) / 2) - minC * PANEL_CELL_SIZE;
    const offY   = panelTop
      + Math.floor((panelHeight - pieceH) / 2)
      - minR * PANEL_CELL_SIZE;

    for (const [r, c] of cells) {
      drawCell(ctx, c, r, PIECE_COLORS[type], PANEL_CELL_SIZE, offX, offY);
    }
  }

  function renderHold() {
    const ctx = dom.holdCtx;
    const W   = dom.holdCanvas.width;
    const H   = dom.holdCanvas.height;

    ctx.fillStyle = canvasTheme.background;
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

    ctx.fillStyle = canvasTheme.background;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 3; i++) {
      renderPieceInPanel(ctx, state.next[i], W, slotH, i * slotH);
    }
  }

  function updateHud() {
    dom.hudScore.textContent     = state.score.toLocaleString();
    dom.hudLevel.textContent     = state.level;
    dom.hudLines.textContent     = state.lines;
    dom.hudHighScore.textContent = state.highScore.toLocaleString();
  }

  function announceGameStatus(message) {
    if (dom.gameStatus) dom.gameStatus.textContent = message;
  }

  function applyBoardEffectVars() {
    const hardDropVisuals = VisualEffects.getHardDropVisuals(state.effects.hardDrop);
    const clearVisuals = VisualEffects.getLineClearVisuals(state.effects.lineClear);
    const pulseStrength = state.effects.boardPulse
      ? state.effects.boardPulse.strength
        * (1 - state.effects.boardPulse.elapsedMs / state.effects.boardPulse.durationMs)
      : 0;

    dom.boardWrapper.style.setProperty('--impact-scale', hardDropVisuals.scaleBoost.toFixed(4));
    dom.boardWrapper.style.setProperty('--impact-shift', hardDropVisuals.shiftPx.toFixed(2));
    dom.boardWrapper.style.setProperty('--board-pulse', Math.max(
      hardDropVisuals.glow,
      clearVisuals.glow,
      pulseStrength
    ).toFixed(4));
  }

  function syncEffectClasses() {
    document.body.classList.toggle('is-theme-morphing', !!state.effects.appearanceMorph);
  }

  function render() {
    applyBoardEffectVars();
    syncEffectClasses();
    renderBoard();
    if (GameEngine.shouldRenderActivePiece(state.phase, state.clearingRows.length)) {
      renderGhost();
      renderCurrentPiece();
    }
    renderHold();
    renderNext();
    renderEffects();
  }

  function hasActiveVisualEffects() {
    if (!state.effects || state.phase === 'paused') return false;
    return Object.values(state.effects).some(Boolean);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 17: SCREEN / PHASE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  function showScreen(id) {
    [dom.screenStart, dom.screenOptions, dom.screenPause, dom.screenGameover].forEach(el => {
      el.classList.remove('screen--active');
      el.setAttribute('aria-hidden', 'true');
    });
    activeScreen = id ? document.getElementById(id) : null;
    if (activeScreen) {
      activeScreen.classList.add('screen--active');
      activeScreen.setAttribute('aria-hidden', 'false');
    }
    if (dom.gameContainer) {
      dom.gameContainer.inert = !!activeScreen;
      dom.gameContainer.setAttribute('aria-hidden', String(!!activeScreen));
    }
    resetInputState();
    markRenderDirty();

    if (activeScreen && typeof activeScreen.querySelector === 'function') {
      const focusTarget = activeScreen.querySelector('button, [tabindex]:not([tabindex="-1"])');
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    }
  }

  function startGame() {
    initState();
    dom.boardWrapper.style.removeProperty('--impact-scale');
    dom.boardWrapper.style.removeProperty('--impact-shift');
    dom.boardWrapper.style.removeProperty('--board-pulse');
    document.body.classList.remove('is-theme-morphing');
    dom.actionText.className = 'action-text';
    dom.actionTextHeadline.textContent = '';
    dom.actionTextDetail.textContent = '';
    dom.levelUpText.className = 'level-up-text';
    dom.levelUpText.textContent = '';
    showScreen(null);
    state.phase = 'playing';
    announceGameStatus('Game started.');
    updateHud();
    dom.highScoreDisplay.textContent = state.highScore.toLocaleString();
  }

  function pauseGame() {
    if (state.phase !== 'playing') return;
    state.phase = 'paused';
    showScreen('screen-pause');
    announceGameStatus('Game paused.');
  }

  function resumeGame() {
    if (state.phase !== 'paused') return;
    state.phase   = 'playing';
    lastTimestamp = null; // prevent a large dt spike after unpause
    showScreen(null);
    announceGameStatus('Game resumed.');
  }

  function triggerGameOver() {
    state.phase = 'gameover';
    state.pendingHardDrop = null;
    state.effects = VisualEffects.createVisualEffectsState();
    updateHighScore();
    dom.finalScore.textContent       = state.score.toLocaleString();
    dom.highScoreDisplay.textContent = state.highScore.toLocaleString();
    showScreen('screen-gameover');
    announceGameStatus(`Game over. Score ${state.score}.`);
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
    if (state.phase === 'playing' || renderDirty || hasActiveVisualEffects()) {
      render();
      renderDirty = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 19: CANVAS SIZING
  // ═══════════════════════════════════════════════════════════════

  function resizeCanvases() {
    const boardW = COLS         * CELL_SIZE;
    const boardH = VISIBLE_ROWS * CELL_SIZE;
    dom.boardCanvas.width  = boardW;
    dom.boardCanvas.height = boardH;
    dom.effectsCanvas.width = boardW + EFFECT_MARGIN * 2;
    dom.effectsCanvas.height = boardH + EFFECT_MARGIN * 2;
    // Keep the drawing buffer fixed; CSS controls responsive display size.
    // Hold (120x120) and next (120x360) sizes are set in HTML attributes.
  }

  function handleVisibilityChange() {
    resetInputState();
    if (document.hidden && state.phase === 'playing') pauseGame();
  }

  function getGameSnapshot() {
    return {
      phase: state.phase,
      current: { ...state.current },
      ghostY: state.ghostY,
      hold: { ...state.hold },
      next: state.next.slice(0, 3),
      score: state.score,
      highScore: state.highScore,
      level: state.level,
      lines: state.lines,
      clearingRows: state.clearingRows.slice(),
      lastAction: state.lastAction,
      lastKickIndex: state.lastKickIndex,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 20: INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  function init() {
    cacheDom();
    prefersReducedMotion = !!(window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    applyOptionsCopy();
    resizeCanvases();

    // Restore last appearance from localStorage and apply it.
    const savedTheme = loadSavedTheme();
    const savedStyle = loadSavedStyle();
    applyAppearance(savedTheme, savedStyle);

    // Wire up appearance controls and normalize every input method through one adapter.
    initAppearanceControls();
    inputController = Input.createInputController({
      actions: ACTIONS,
      actionForCode: GameEngine.actionForCode,
      controls: dom.gameControlButtons,
      dispatchAction: dispatchGameAction,
      document,
      onTab: trapScreenFocus,
      releaseAction: endRepeatingAction,
      repeatingActions: REPEATING_ACTIONS,
      window,
    });
    inputController.bind();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Pre-initialise state so the background renders on first frame
    initState(false);
    state.phase = 'start';
    showScreen('screen-start');

    lastTimestamp = null;
    requestAnimationFrame(gameLoop);
  }

  window.TetrisGameRuntime = Object.freeze({
    ACTIONS,
    dispatchAction: dispatchGameAction,
    getSnapshot: getGameSnapshot,
    start: startGame,
  });

  document.addEventListener('DOMContentLoaded', init);

})();
