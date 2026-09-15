const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const engine = require('../game-engine.js');
const input = require('../game-input.js');
const effects = require('../effects.js');
const themeOptions = require('../theme-options.js');

test('runtime handles standard Space, hold locking, and persisted value recovery', () => {
  const runtime = createRuntime({ tetris_highscore: 'not-a-number' });
  const { context, documentListeners, elements, localStorage } = runtime;

  documentListeners.DOMContentLoaded[0]();
  context.TetrisGameRuntime.start();

  const initial = context.TetrisGameRuntime.getSnapshot();
  assert.equal(initial.current.y, 1);
  assert.equal(initial.highScore, 0);
  assert.equal(localStorage.getItem('tetris_highscore'), '0');

  let prevented = false;
  documentListeners.keydown[0]({
    code: 'Space',
    target: elements.get('canvas-board'),
    preventDefault() { prevented = true; },
  });

  const afterDrop = context.TetrisGameRuntime.getSnapshot();
  assert.equal(prevented, true);
  assert.ok(afterDrop.score > 0);
  assert.notEqual(afterDrop.current.type, 0);

  context.TetrisGameRuntime.start();
  context.TetrisGameRuntime.dispatchAction(engine.ACTIONS.HOLD);
  const afterFirstHold = context.TetrisGameRuntime.getSnapshot();
  assert.equal(afterFirstHold.hold.locked, true);

  context.TetrisGameRuntime.dispatchAction(engine.ACTIONS.HOLD);
  const afterSecondHold = context.TetrisGameRuntime.getSnapshot();
  assert.deepEqual(afterSecondHold.current, afterFirstHold.current);
  assert.deepEqual(afterSecondHold.hold, afterFirstHold.hold);
});

test('Enter on an interactive menu control is left to the button', () => {
  const { context, documentListeners, elements } = createRuntime();
  documentListeners.DOMContentLoaded[0]();

  const optionsButton = elements.get('btn-open-options');
  let prevented = false;
  documentListeners.keydown[0]({
    code: 'Enter',
    target: optionsButton,
    preventDefault() { prevented = true; },
  });

  assert.equal(context.TetrisGameRuntime.getSnapshot().phase, 'start');
  assert.equal(prevented, false);

  context.TetrisGameRuntime.start();
  context.TetrisGameRuntime.dispatchAction(engine.ACTIONS.PAUSE);
  assert.equal(context.TetrisGameRuntime.getSnapshot().phase, 'paused');

  documentListeners.keydown[0]({
    code: 'Escape',
    target: elements.get('btn-resume'),
    preventDefault() {},
  });
  assert.equal(context.TetrisGameRuntime.getSnapshot().phase, 'playing');
});

test('on-screen controls dispatch the same hard-drop action', () => {
  const { context, documentListeners, controls } = createRuntime();
  documentListeners.DOMContentLoaded[0]();
  context.TetrisGameRuntime.start();

  const left = controls.find(button => button.dataset.gameAction === engine.ACTIONS.MOVE_LEFT);
  const beforeMove = context.TetrisGameRuntime.getSnapshot().current.x;
  left.dispatchEvent({ type: 'pointerdown', target: left, pointerId: 1, preventDefault() {} });
  left.dispatchEvent({ type: 'pointerup', target: left, pointerId: 1, preventDefault() {} });
  left.click();
  assert.equal(context.TetrisGameRuntime.getSnapshot().current.x, beforeMove - 1);

  controls.find(button => button.dataset.gameAction === engine.ACTIONS.HARD_DROP).click();

  assert.ok(context.TetrisGameRuntime.getSnapshot().score > 0);
});

test('gravity and lock delay advance through animation frames', () => {
  const runtime = startRuntime();
  const game = runtime.context.TetrisGameRuntime;
  runtime.advance(990);
  assert.equal(game.getSnapshot().current.y, 1);
  runtime.advance(10);
  assert.equal(game.getSnapshot().current.y, 2);

  while (game.getSnapshot().current.y < game.getSnapshot().ghostY) {
    game.dispatchAction(engine.ACTIONS.SOFT_DROP);
  }
  runtime.advance(490);
  assert.equal(game.getSnapshot().current.y, game.getSnapshot().ghostY);
  runtime.advance(10);
  assert.equal(game.getSnapshot().current.y, 1);
  runtime.advance(10);
  assert.equal(game.getSnapshot().current.y, 1);
});

for (const source of ['keyboard', 'pointer']) {
  test(`${source} movement pressed during a clear resumes on the next piece`, () => {
    const runtime = startRuntime();
    const game = runtime.context.TetrisGameRuntime;
    clearBottomRow(runtime);
    const lockedPiece = game.getSnapshot().current;
    runtime.pressLeft(source);
    runtime.advance(290);
    assert.deepEqual(game.getSnapshot().current, lockedPiece);
    assert.equal(game.getSnapshot().clearingRows.length, 1);
    runtime.advance(10);
    assert.equal(game.getSnapshot().clearingRows.length, 0);
    assert.equal(game.getSnapshot().current.y, 1);
    const spawnX = game.getSnapshot().current.x;
    runtime.advance(210);
    assert.ok(game.getSnapshot().current.x < spawnX);
    runtime.releaseLeft(source);
    const releasedX = game.getSnapshot().current.x;
    runtime.advance(250);
    assert.equal(game.getSnapshot().current.x, releasedX);
  });

  test(`${source} movement released during a clear does not move the next piece`, () => {
    const runtime = startRuntime();
    clearBottomRow(runtime);
    runtime.pressLeft(source);
    runtime.advance(100);
    runtime.releaseLeft(source);
    runtime.advance(200);
    const spawnX = runtime.context.TetrisGameRuntime.getSnapshot().current.x;
    runtime.advance(300);
    assert.equal(runtime.context.TetrisGameRuntime.getSnapshot().current.x, spawnX);
  });
}

test('hiding the document pauses gravity and releases held movement', () => {
  const runtime = startRuntime();
  runtime.pressLeft('keyboard');
  runtime.context.document.hidden = true;
  runtime.documentListeners.visibilitychange[0]();
  const paused = runtime.context.TetrisGameRuntime.getSnapshot();
  assert.equal(paused.phase, 'paused');
  runtime.advance(2000);
  assert.deepEqual(runtime.context.TetrisGameRuntime.getSnapshot().current, paused.current);
  runtime.context.document.hidden = false;
  runtime.documentListeners.visibilitychange[0]();
  runtime.context.TetrisGameRuntime.dispatchAction(engine.ACTIONS.PAUSE);
  runtime.advance(0);
  runtime.advance(500);
  assert.deepEqual(runtime.context.TetrisGameRuntime.getSnapshot().current, paused.current);
});

for (const releaseDuringClear of [false, true]) {
  test(`soft drop ${releaseDuringClear ? 'released' : 'held'} during a clear respects its input state`, () => {
    const runtime = startRuntime();
    const game = runtime.context.TetrisGameRuntime;
    clearBottomRow(runtime);
    const before = game.getSnapshot();
    const event = { code: 'ArrowDown', target: null, preventDefault() {} };
    runtime.documentListeners.keydown[0](event);
    runtime.advance(100);
    assert.deepEqual(game.getSnapshot().current, before.current);
    assert.equal(game.getSnapshot().score, before.score);
    if (releaseDuringClear) runtime.documentListeners.keyup[0](event);
    runtime.advance(200);
    const spawned = game.getSnapshot();
    runtime.advance(100);
    const after = game.getSnapshot();
    if (releaseDuringClear) {
      assert.deepEqual(after.current, spawned.current);
      assert.equal(after.score, spawned.score);
    } else {
      assert.ok(after.current.y > spawned.current.y);
      assert.equal(after.score - spawned.score, after.current.y - spawned.current.y);
    }
  });
}

function startRuntime() {
  const runtime = createRuntime({}, () => 0);
  runtime.documentListeners.DOMContentLoaded[0]();
  runtime.context.TetrisGameRuntime.start();
  runtime.advance(0);
  return runtime;
}

function clearBottomRow(runtime) {
  const game = runtime.context.TetrisGameRuntime;
  // A deterministic bag starts I, L, J. Their bottom edges fill 4 + 3 + 3 cells.
  for (const [type, x] of [[1, 0], [7, 4], [6, 7]]) {
    assert.equal(game.getSnapshot().current.type, type);
    const distance = x - game.getSnapshot().current.x;
    for (let step = 0; step < Math.abs(distance); step++) {
      game.dispatchAction(distance < 0 ? engine.ACTIONS.MOVE_LEFT : engine.ACTIONS.MOVE_RIGHT);
    }
    game.dispatchAction(engine.ACTIONS.HARD_DROP);
  }
  assert.equal(game.getSnapshot().lines, 1);
  assert.equal(game.getSnapshot().clearingRows.length, 1);
}

function createRuntime(seed = {}, random = Math.random) {
  const elementIds = [
    'game-container',
    'board-wrapper',
    'canvas-board',
    'canvas-hold',
    'canvas-next',
    'hud-score',
    'hud-level',
    'hud-lines',
    'hud-high-score',
    'action-text',
    'action-text-headline',
    'action-text-detail',
    'level-up-text',
    'game-status',
    'screen-start',
    'screen-options',
    'screen-pause',
    'screen-gameover',
    'final-score',
    'high-score-display',
    'menu-appearance-summary',
    'options-subtitle',
    'options-mode-title',
    'options-mode-copy',
    'options-themes-title',
    'options-themes-copy',
    'preset-grid',
    'btn-start',
    'btn-open-options',
    'btn-options-back',
    'btn-resume',
    'btn-play-again',
    'btn-open-options-gameover',
  ];
  const elements = new Map(elementIds.map(id => [id, createElement(id)]));
  attachCanvas(elements.get('canvas-board'), 300, 600);
  attachCanvas(elements.get('canvas-hold'), 120, 120);
  attachCanvas(elements.get('canvas-next'), 120, 360);

  const cards = Object.keys(themeOptions.STYLE_OPTION_CONFIG).map(style => {
    const card = createElement(style);
    card.dataset.styleValue = style;
    card.closest = selector => (selector === '.preset-card' ? card : null);
    return card;
  });
  elements.get('preset-grid').querySelectorAll = selector => (
    selector === '.preset-card' ? cards : []
  );

  const modeButtons = ['dark', 'bright'].map(mode => {
    const button = createElement(mode);
    button.dataset.modeValue = mode;
    return button;
  });
  const controls = Object.values(engine.ACTIONS)
    .filter(action => action !== engine.ACTIONS.START)
    .map(action => {
      const button = createElement(`control-${action}`);
      button.dataset.gameAction = action;
      return button;
    });
  const documentListeners = {};
  const documentElement = createElement('html');
  const body = createElement('body');
  const document = {
    documentElement,
    body,
    activeElement: null,
    hidden: false,
    getElementById: id => elements.get(id) || null,
    querySelectorAll(selector) {
      if (selector === '.mode-chip') return modeButtons;
      if (selector === '[data-game-action]') return controls;
      return [];
    },
    addEventListener(type, handler) {
      (documentListeners[type] ||= []).push(handler);
    },
  };

  const storage = new Map(Object.entries(seed));
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(String(key), String(value)); },
  };
  let timestamp = 0;
  let nextFrame;
  const runtimeMath = Object.create(Math);
  runtimeMath.random = random;
  const context = {
    window: null,
    document,
    localStorage,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    Math: runtimeMath,
    requestAnimationFrame(callback) { nextFrame = callback; return 1; },
    cancelAnimationFrame() {},
    setTimeout,
    clearTimeout,
    performance: { now: () => 0 },
    console,
    TetrisGameEngine: engine,
    TetrisInput: input,
    TetrisEffects: effects,
    TetrisThemeOptions: themeOptions,
  };
  context.window = context;

  const source = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'game.js' });

  function advance(duration) {
    let remaining = duration;
    do {
      const dt = Math.min(10, remaining);
      timestamp += dt;
      const callback = nextFrame;
      nextFrame = null;
      assert.equal(typeof callback, 'function', 'game loop must schedule its next frame');
      callback(timestamp);
      remaining -= dt;
    } while (remaining > 0);
  }

  function leftEvent(source, pressed) {
    if (source === 'keyboard') {
      const type = pressed ? 'keydown' : 'keyup';
      documentListeners[type][0]({ code: 'ArrowLeft', target: null, preventDefault() {} });
    } else {
      const button = controls.find(control => control.dataset.gameAction === engine.ACTIONS.MOVE_LEFT);
      const type = pressed ? 'pointerdown' : 'pointerup';
      const event = { type, target: button, pointerId: 1, preventDefault() {} };
      button.dispatchEvent(event);
      // Pointer events bubble to the document after the target handles them.
      (documentListeners[type] || []).forEach(handler => handler(event));
    }
  }

  return {
    context, controls, documentListeners, elements, localStorage, advance,
    pressLeft: source => leftEvent(source, true),
    releaseLeft: source => leftEvent(source, false),
  };
}

function attachCanvas(canvas, width, height) {
  canvas.width = width;
  canvas.height = height;
  canvas.getContext = () => createCanvasContext();
}

function createCanvasContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    save() {},
    restore() {},
  };
}

function createElement(id) {
  const listeners = {};
  const classes = new Set();
  const attributes = new Map();
  const element = {
    id,
    dataset: {},
    textContent: '',
    className: '',
    width: 0,
    height: 0,
    inert: false,
    style: { setProperty() {}, removeProperty() {} },
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle(name, force) {
        if (force === true) classes.add(name);
        else if (force === false) classes.delete(name);
        else if (classes.has(name)) classes.delete(name);
        else classes.add(name);
      },
      contains: name => classes.has(name),
    },
    addEventListener(type, handler) {
      (listeners[type] ||= []).push(handler);
    },
    dispatchEvent(event) {
      (listeners[event.type] || []).forEach(handler => handler.call(element, event));
    },
    click() {
      element.dispatchEvent({ type: 'click', target: element, preventDefault() {} });
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest(selector) {
      return selector.includes('button') && id.startsWith('btn-') ? element : null;
    },
    focus() {},
  };
  return element;
}
