(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.TetrisInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createInputController({
    actions,
    actionForCode,
    controls,
    dispatchAction,
    document,
    onTab,
    releaseAction,
    repeatingActions,
    window,
  }) {
    const keys = {};
    const heldPointers = new Map();
    const repeating = new Set(repeatingActions);
    const controlButtons = Array.from(controls || []);

    function isInteractiveTarget(target) {
      return !!(target && typeof target.closest === 'function'
        && target.closest('button, a, input, select, textarea, [role="button"]'));
    }

    function isKeyboardActionHeld(action) {
      return Object.entries(keys).some(([code, isHeld]) => (
        isHeld && actionForCode(code) === action
      ));
    }

    function releaseIfUnused(action) {
      const pointerHeld = Array.from(heldPointers.values()).some(pointer => pointer.action === action);
      if (!action || pointerHeld || isKeyboardActionHeld(action)) return;
      releaseAction(action);
    }

    function onKeyDown(event) {
      if (event.code === 'Tab' && onTab && onTab(event)) return;

      const action = actionForCode(event.code);
      if (!action) return;
      if (isInteractiveTarget(event.target)
        && (action === actions.START || action === actions.HARD_DROP)) return;
      if (keys[event.code]) return;

      const handled = dispatchAction(action, repeating.has(action));
      if (!handled) return;

      keys[event.code] = true;
      event.preventDefault();
    }

    function onKeyUp(event) {
      const action = actionForCode(event.code);
      keys[event.code] = false;
      releaseIfUnused(action);
    }

    function endPointerAction(event) {
      const pointer = heldPointers.get(event.pointerId);
      if (!pointer) return;
      heldPointers.delete(event.pointerId);
      releaseIfUnused(pointer.action);

      function clearPointerTrigger() {
        if (!Array.from(heldPointers.values()).some(held => held.button === pointer.button)) {
          pointer.button.dataset.pointerTriggered = 'false';
        }
      }
      // Keep the flag through the click that follows pointerup, but do not
      // change another finger's button or suppress a later keyboard click.
      if (event.type === 'pointerup') {
        if (window && typeof window.setTimeout === 'function') {
          window.setTimeout(clearPointerTrigger, 0);
        }
      } else clearPointerTrigger();
    }

    function bindControl(button) {
      const action = button.dataset.gameAction;
      const isRepeating = repeating.has(action);

      if (isRepeating) {
        button.addEventListener('pointerdown', event => {
          event.preventDefault();
          const handled = dispatchAction(action, true);
          if (!handled) return;
          button.dataset.pointerTriggered = 'true';
          heldPointers.set(event.pointerId, { action, button });
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
          button.addEventListener(type, endPointerAction);
        });
      }

      button.addEventListener('click', event => {
        if (button.dataset.pointerTriggered === 'true') {
          button.dataset.pointerTriggered = 'false';
          return;
        }
        event.preventDefault();
        dispatchAction(action, false);
      });
    }

    function reset() {
      Object.keys(keys).forEach(code => { keys[code] = false; });
      heldPointers.clear();
      controlButtons.forEach(button => { button.dataset.pointerTriggered = 'false'; });
      repeating.forEach(releaseAction);
    }

    function bind() {
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      document.addEventListener('pointerup', endPointerAction);
      document.addEventListener('pointercancel', endPointerAction);
      controlButtons.forEach(bindControl);

      if (window && typeof window.addEventListener === 'function') {
        window.addEventListener('blur', reset);
      }
    }

    return Object.freeze({ bind, reset });
  }

  return { createInputController };
});
