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
    const pointerHeldActions = new Set();
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
      if (!action || pointerHeldActions.has(action) || isKeyboardActionHeld(action)) return;
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

    function endPointerAction(action) {
      pointerHeldActions.delete(action);
      releaseIfUnused(action);
    }

    function releasePointerActions() {
      Array.from(pointerHeldActions).forEach(endPointerAction);
      if (window && typeof window.setTimeout === 'function') {
        window.setTimeout(() => {
          controlButtons.forEach(button => { button.dataset.pointerTriggered = 'false'; });
        }, 0);
      }
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
          pointerHeldActions.add(action);
        });
        button.addEventListener('pointerup', () => endPointerAction(action));
        ['pointercancel', 'pointerleave'].forEach(type => {
          button.addEventListener(type, () => {
            endPointerAction(action);
            button.dataset.pointerTriggered = 'false';
          });
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
      pointerHeldActions.clear();
      repeating.forEach(releaseAction);
    }

    function bind() {
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      document.addEventListener('pointerup', releasePointerActions);
      document.addEventListener('pointercancel', releasePointerActions);
      controlButtons.forEach(bindControl);

      if (window && typeof window.addEventListener === 'function') {
        window.addEventListener('blur', reset);
      }
    }

    return Object.freeze({ bind, reset });
  }

  return { createInputController };
});
