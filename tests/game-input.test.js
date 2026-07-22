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
  controlListeners.pointerdown[0]({ preventDefault() {} });
  documentListeners.keyup[0](event);
  assert.deepEqual(releases, []);

  controlListeners.pointerup[0]();
  assert.deepEqual(releases, [engine.ACTIONS.MOVE_LEFT]);
  assert.deepEqual(dispatches, [
    [engine.ACTIONS.MOVE_LEFT, true],
    [engine.ACTIONS.MOVE_LEFT, true],
  ]);
});

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
