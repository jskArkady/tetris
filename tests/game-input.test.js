const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../game-engine.js');
const { createInputController } = require('../game-input.js');

test('repeat actions remain held until every input source releases them', () => {
  const documentListeners = {};
  const windowListeners = {};
  const controlListeners = {};
  const releases = [];
  const dispatches = [];
  const leftControl = {
    dataset: { gameAction: engine.ACTIONS.MOVE_LEFT },
    addEventListener(type, handler) { (controlListeners[type] ||= []).push(handler); },
  };
  const document = {
    addEventListener(type, handler) { (documentListeners[type] ||= []).push(handler); },
  };
  const window = {
    addEventListener(type, handler) { (windowListeners[type] ||= []).push(handler); },
    setTimeout(handler) { handler(); },
  };
  const controller = createInputController({
    actions: engine.ACTIONS,
    actionForCode: engine.actionForCode,
    controls: [leftControl],
    dispatchAction(action, repeat) {
      dispatches.push([action, repeat]);
      return true;
    },
    document,
    releaseAction(action) { releases.push(action); },
    repeatingActions: new Set([engine.ACTIONS.MOVE_LEFT]),
    window,
  });
  controller.bind();

  const event = { code: 'ArrowLeft', target: null, preventDefault() {} };
  documentListeners.keydown[0](event);
  controlListeners.pointerdown[0]({ pointerId: 1, preventDefault() {} });
  documentListeners.keyup[0](event);
  assert.deepEqual(releases, []);

  controlListeners.pointerup[0]({ type: 'pointerup', pointerId: 1 });
  assert.deepEqual(releases, [engine.ACTIONS.MOVE_LEFT]);
  assert.deepEqual(dispatches, [
    [engine.ACTIONS.MOVE_LEFT, true],
    [engine.ACTIONS.MOVE_LEFT, true],
  ]);
});

for (const endEvent of ['pointerup', 'pointercancel', 'pointerleave']) {
  test(`${endEvent} releases only the matching pointer`, () => {
    const runtime = createPointerHarness();
    runtime.send('move-left', 'pointerdown', 1);
    runtime.send('soft-drop', 'pointerdown', 2);
    runtime.send('soft-drop', endEvent, 2);
    assert.deepEqual(runtime.releases, ['soft-drop']);
    runtime.send('move-left', 'pointerup', 1);
    assert.deepEqual(runtime.releases, ['soft-drop', 'move-left']);
  });
}

test('two pointers on the same action keep it held until both release', () => {
  const runtime = createPointerHarness();
  runtime.send('move-left', 'pointerdown', 1);
  runtime.send('move-left', 'pointerdown', 2);
  runtime.send('move-left', 'pointerup', 1);
  assert.deepEqual(runtime.releases, []);
  runtime.send('move-left', 'pointerup', 2);
  assert.deepEqual(runtime.releases, ['move-left']);
});

test('unrelated document pointer releases do not cancel held controls', () => {
  const runtime = createPointerHarness();
  runtime.send('move-left', 'pointerdown', 1);
  runtime.send(null, 'pointerup', 99);
  assert.deepEqual(runtime.releases, []);
  runtime.send(null, 'pointerup', 1);
  assert.deepEqual(runtime.releases, ['move-left']);
});

test('pointer clicks are suppressed once while keyboard clicks still dispatch', () => {
  const runtime = createPointerHarness();
  runtime.send('move-left', 'pointerdown', 1);
  runtime.send('move-left', 'pointerup', 1);
  runtime.send('move-left', 'click', 1);
  assert.equal(runtime.dispatches.length, 1);
  runtime.flushTimers();
  runtime.send('move-left', 'click');
  assert.equal(runtime.dispatches.length, 2);
});

test('blur clears all held inputs and allows the next button activation', () => {
  const runtime = createPointerHarness();
  runtime.send('move-left', 'pointerdown', 1);
  runtime.send('soft-drop', 'pointerdown', 2);
  runtime.blur();
  assert.deepEqual(runtime.releases, ['move-left', 'soft-drop']);
  runtime.send('move-left', 'click');
  assert.equal(runtime.dispatches.length, 3);
});

function createPointerHarness() {
  const listeners = new Map();
  const documentListeners = {};
  const windowListeners = {};
  const timers = [];
  const releases = [];
  const dispatches = [];
  const controls = ['move-left', 'soft-drop'].map(action => {
    const handlers = {};
    listeners.set(action, handlers);
    return {
      dataset: { gameAction: action },
      addEventListener(type, handler) { (handlers[type] ||= []).push(handler); },
    };
  });
  createInputController({
    actions: engine.ACTIONS,
    actionForCode: engine.actionForCode,
    controls,
    dispatchAction(action, repeat) { dispatches.push([action, repeat]); return true; },
    document: {
      addEventListener(type, handler) { (documentListeners[type] ||= []).push(handler); },
    },
    releaseAction(action) { releases.push(action); },
    repeatingActions: ['move-left', 'soft-drop'],
    window: {
      addEventListener(type, handler) { windowListeners[type] = handler; },
      setTimeout(handler) { timers.push(handler); },
    },
  }).bind();

  return {
    releases, dispatches,
    blur: () => windowListeners.blur(),
    flushTimers: () => { while (timers.length) timers.shift()(); },
    send(action, type, pointerId) {
      const event = { type, pointerId, preventDefault() {} };
      (listeners.get(action)?.[type] || []).forEach(handler => handler(event));
      if (type !== 'pointerleave') {
        (documentListeners[type] || []).forEach(handler => handler(event));
      }
    },
  };
}

test('interactive buttons keep native Enter and Space activation', () => {
  const listeners = {};
  const dispatched = [];
  const document = {
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
  };
  createInputController({
    actions: engine.ACTIONS,
    actionForCode: engine.actionForCode,
    controls: [],
    dispatchAction(action) { dispatched.push(action); return true; },
    document,
    releaseAction() {},
    repeatingActions: new Set(),
    window: { addEventListener() {} },
  }).bind();

  const button = { closest: () => button };
  for (const code of ['Enter', 'Space']) {
    listeners.keydown[0]({
      code,
      target: button,
      preventDefault() { assert.fail(`${code} default was prevented`); },
    });
  }
  assert.deepEqual(dispatched, []);
});
