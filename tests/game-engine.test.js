const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACTIONS,
  actionForCode,
  classifyTSpin,
  getSpawnY,
  isBackToBackWorthy,
  normalizeHighScore,
  normalizeStyle,
  shouldRenderActivePiece,
} = require('../game-engine.js');

test('standard KeyboardEvent codes map to game actions', () => {
  assert.equal(actionForCode('Space'), ACTIONS.HARD_DROP);
  assert.equal(actionForCode(' '), null);
  assert.equal(actionForCode('ArrowLeft'), ACTIONS.MOVE_LEFT);
  assert.equal(actionForCode('Enter'), ACTIONS.START);
});

test('spawn row leaves a piece partially visible below hidden rows', () => {
  assert.equal(getSpawnY(22, 20), 1);
  assert.equal(getSpawnY(20, 20), 0);
});

test('high score accepts only non-negative safe integers', () => {
  assert.equal(normalizeHighScore('1200'), 1200);
  assert.equal(normalizeHighScore('not-a-number'), 0);
  assert.equal(normalizeHighScore('-1'), 0);
  assert.equal(normalizeHighScore('12.5'), 0);
});

test('style normalization accepts only own configuration keys', () => {
  const config = { fluent: { label: 'Glass' } };

  assert.equal(normalizeStyle('fluent', config, 'fluent'), 'fluent');
  assert.equal(normalizeStyle('__proto__', config, 'fluent'), 'fluent');
  assert.equal(normalizeStyle('constructor', config, 'fluent'), 'fluent');
});

test('T-spin classification follows rotation and corner state', () => {
  assert.equal(classifyTSpin({
    occupiedCorners: [true, true, true, false],
    rotation: 0,
    lastAction: 'hard-drop',
    kickIndex: 1,
  }), null);

  assert.deepEqual(classifyTSpin({
    occupiedCorners: [true, true, true, false],
    rotation: 0,
    lastAction: 'rotate',
    kickIndex: 0,
  }), { isTSpin: true, isMini: false });

  assert.deepEqual(classifyTSpin({
    occupiedCorners: [true, false, true, true],
    rotation: 0,
    lastAction: 'rotate',
    kickIndex: 0,
  }), { isTSpin: true, isMini: true });

  assert.deepEqual(classifyTSpin({
    occupiedCorners: [true, false, true, true],
    rotation: 0,
    lastAction: 'rotate',
    kickIndex: 4,
  }), { isTSpin: true, isMini: false });
});

test('difficult line clears retain back-to-back and clear animation hides the active piece', () => {
  assert.equal(isBackToBackWorthy({ linesCleared: 4, isTSpin: false, isTetris: true }), true);
  assert.equal(isBackToBackWorthy({ linesCleared: 1, isTSpin: true, isTetris: false }), true);
  assert.equal(isBackToBackWorthy({ linesCleared: 2, isTSpin: false, isTetris: false }), false);

  assert.equal(shouldRenderActivePiece('playing', 0), true);
  assert.equal(shouldRenderActivePiece('playing', 1), false);
  assert.equal(shouldRenderActivePiece('gameover', 0), false);
});
