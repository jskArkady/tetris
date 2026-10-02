const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildActionNotification,
  buildLevelUpNotification,
  createVisualEffectsState,
  getHardDropVisuals,
  getLineClearVisuals,
  getParticleVisuals,
  triggerAppearanceMorph,
  triggerHardDropImpact,
  triggerLineClearSweep,
  tickVisualEffects,
} = require('../effects.js');

test('hard drop impact stores rows and expires after its duration', () => {
  const effects = createVisualEffectsState();

  triggerHardDropImpact(effects, 4, 19);

  assert.equal(effects.hardDrop.fromRow, 4);
  assert.equal(effects.hardDrop.toRow, 19);
  assert.ok(effects.hardDrop.strength > 0.9);
  assert.ok(effects.boardPulse.strength > 0.5);

  tickVisualEffects(effects, 200);

  assert.equal(effects.hardDrop, null);
});

test('line clear sweep stores cleared rows and expires cleanly', () => {
  const effects = createVisualEffectsState();

  triggerLineClearSweep(effects, [18, 19, 20, 21]);

  assert.deepEqual(effects.lineClear.rows, [18, 19, 20, 21]);
  assert.equal(effects.lineClear.elapsedMs, 0);
  assert.ok(effects.boardPulse.strength >= 0.75);

  tickVisualEffects(effects, 400);

  assert.equal(effects.lineClear, null);
});

test('hard drop visuals expose scale, shift, and glow for board polish', () => {
  const effects = createVisualEffectsState();

  triggerHardDropImpact(effects, 10, 19);

  const visuals = getHardDropVisuals(effects.hardDrop);

  assert.ok(visuals.scaleBoost > 0);
  assert.ok(visuals.shiftPx > 0);
  assert.ok(visuals.shiftPx <= 4);
  assert.ok(visuals.glow > 0);
});

test('line clear visuals expose sweep progress for canvas rendering', () => {
  const effects = createVisualEffectsState();

  triggerLineClearSweep(effects, [20, 21]);
  tickVisualEffects(effects, 180);

  const visuals = getLineClearVisuals(effects.lineClear);

  assert.deepEqual(visuals.rows, [20, 21]);
  assert.ok(visuals.sweep > 0.45 && visuals.sweep < 0.55);
  assert.ok(visuals.alpha < 1);
  assert.ok(visuals.glow > 0);
});

test('action notification separates headline and supporting detail', () => {
  assert.deepEqual(
    buildActionNotification({
      actionLabel: 'TETRIS!',
      b2bBonus: true,
      combo: 3,
      linesCleared: 4,
    }),
    {
      headline: 'TETRIS!',
      detail: 'BACK-TO-BACK! • 3x COMBO',
      tone: 'critical',
      durationMs: 2100,
    }
  );

  assert.deepEqual(
    buildActionNotification({
      actionLabel: 'DOUBLE',
      b2bBonus: false,
      combo: 1,
      linesCleared: 2,
    }),
    {
      headline: 'DOUBLE',
      detail: '',
      tone: 'strong',
      durationMs: 1800,
    }
  );
});

test('level-up notification uses a dedicated tone and duration', () => {
  assert.deepEqual(
    buildLevelUpNotification(5),
    {
      headline: 'LEVEL 5!',
      detail: 'Speed up',
      tone: 'level',
      durationMs: 1600,
    }
  );
});

test('appearance morph can restart from zero elapsed time', () => {
  const effects = createVisualEffectsState();

  triggerAppearanceMorph(effects);
  tickVisualEffects(effects, 80);
  triggerAppearanceMorph(effects);

  assert.equal(effects.appearanceMorph.elapsedMs, 0);
});

test('clear snapshots and landing cells are detached from live game data', () => {
  const state = createVisualEffectsState();
  const cells = [[20, 4], [21, 4]];
  triggerHardDropImpact(state, 1, 20, cells, 1);
  cells[0][0] = 0;
  assert.equal(state.hardDrop.cells[0][0], 20);

  const board = Array.from({ length: 22 }, () => new Array(10).fill(3));
  const rows = [18, 19, 20, 21];
  triggerLineClearSweep(state, rows, board, 3);
  board[21].fill(0);
  rows[0] = 0;
  assert.deepEqual(state.lineClear.rows, [18, 19, 20, 21]);
  assert.deepEqual(state.lineClear.snapshots[3].cells, new Array(10).fill(3));
  assert.ok(state.lineClear.particles.length <= 32);
  assert.ok(state.lineClear.strength >= 0.95 && state.lineClear.strength <= 1);
});

test('shards are deterministic, bounded, and expire without consuming gameplay randomness', () => {
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('effects must not consume the bag RNG'); };
  try {
    const first = createVisualEffectsState();
    const second = createVisualEffectsState();
    triggerLineClearSweep(first, [20, 21]);
    triggerLineClearSweep(second, [20, 21]);
    tickVisualEffects(first, 80);
    tickVisualEffects(first, 80);
    tickVisualEffects(second, 160);
    assert.deepEqual(getParticleVisuals(first.lineClear), getParticleVisuals(second.lineClear));
    for (const particle of getParticleVisuals(first.lineClear)) {
      assert.ok(Number.isFinite(particle.col) && Number.isFinite(particle.row));
      assert.ok(particle.alpha > 0 && particle.alpha < 1);
      assert.ok(particle.size > 0 && particle.size < 0.3);
    }
    tickVisualEffects(first, 200);
    assert.deepEqual(getParticleVisuals(first.lineClear), []);
  } finally {
    Math.random = originalRandom;
  }
});
