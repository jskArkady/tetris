(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.TetrisGameEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ACTIONS = Object.freeze({
    MOVE_LEFT: 'move-left',
    MOVE_RIGHT: 'move-right',
    SOFT_DROP: 'soft-drop',
    HARD_DROP: 'hard-drop',
    ROTATE_CW: 'rotate-cw',
    ROTATE_CCW: 'rotate-ccw',
    HOLD: 'hold',
    PAUSE: 'pause',
    START: 'start',
  });

  const KEY_ACTIONS = Object.freeze({
    ArrowLeft: ACTIONS.MOVE_LEFT,
    ArrowRight: ACTIONS.MOVE_RIGHT,
    ArrowDown: ACTIONS.SOFT_DROP,
    ArrowUp: ACTIONS.ROTATE_CW,
    KeyX: ACTIONS.ROTATE_CW,
    KeyZ: ACTIONS.ROTATE_CCW,
    KeyC: ACTIONS.HOLD,
    ShiftLeft: ACTIONS.HOLD,
    ShiftRight: ACTIONS.HOLD,
    Space: ACTIONS.HARD_DROP,
    Escape: ACTIONS.PAUSE,
    KeyP: ACTIONS.PAUSE,
    Enter: ACTIONS.START,
  });

  const FRONT_CORNERS = Object.freeze({
    0: [0, 1],
    1: [1, 3],
    2: [2, 3],
    3: [0, 2],
  });

  function actionForCode(code) {
    return KEY_ACTIONS[code] || null;
  }

  function getSpawnY(rows, visibleRows) {
    return Math.max(0, rows - visibleRows - 1);
  }

  function normalizeHighScore(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  function normalizeStyle(style, config, fallbackStyle) {
    return Object.prototype.hasOwnProperty.call(config || {}, style)
      ? style
      : fallbackStyle;
  }

  function classifyTSpin({ occupiedCorners, rotation, lastAction, kickIndex }) {
    if (lastAction !== 'rotate') return null;
    if (!Array.isArray(occupiedCorners) || occupiedCorners.length !== 4) return null;

    const occupied = occupiedCorners.map(Boolean);
    if (occupied.filter(Boolean).length < 3) return null;

    const frontIndices = FRONT_CORNERS[rotation];
    if (!frontIndices) return null;

    const frontFilled = frontIndices.filter(index => occupied[index]).length;
    const upgradedByFinalKick = kickIndex === 4;

    return {
      isTSpin: true,
      isMini: frontFilled < 2 && !upgradedByFinalKick,
    };
  }

  function isBackToBackWorthy({ linesCleared, isTSpin, isTetris }) {
    return !!(isTetris || (isTSpin && linesCleared > 0));
  }

  function shouldRenderActivePiece(phase, clearingRowCount) {
    return (phase === 'playing' || phase === 'paused') && clearingRowCount === 0;
  }

  return {
    ACTIONS,
    KEY_ACTIONS,
    actionForCode,
    classifyTSpin,
    getSpawnY,
    isBackToBackWorthy,
    normalizeHighScore,
    normalizeStyle,
    shouldRenderActivePiece,
  };
});
