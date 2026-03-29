(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.TetrisEffects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const HARD_DROP_EFFECT_MS = 180;
  const LINE_CLEAR_EFFECT_MS = 360;
  const BOARD_PULSE_MS = 240;
  const APPEARANCE_MORPH_MS = 220;

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function createVisualEffectsState() {
    return {
      hardDrop: null,
      lineClear: null,
      boardPulse: null,
      appearanceMorph: null,
    };
  }

  function triggerHardDropImpact(state, fromRow, toRow) {
    const distance = Math.max(0, toRow - fromRow);
    const strength = Math.min(1, 0.35 + distance / 12);

    state.hardDrop = {
      fromRow,
      toRow,
      strength,
      elapsedMs: 0,
      durationMs: HARD_DROP_EFFECT_MS,
    };

    state.boardPulse = {
      strength: Math.max(0.5, strength * 0.85),
      elapsedMs: 0,
      durationMs: BOARD_PULSE_MS,
    };

    return state.hardDrop;
  }

  function triggerLineClearSweep(state, rows) {
    state.lineClear = {
      rows: rows.slice(),
      elapsedMs: 0,
      durationMs: LINE_CLEAR_EFFECT_MS,
    };

    state.boardPulse = {
      strength: Math.min(1, 0.55 + rows.length * 0.08),
      elapsedMs: 0,
      durationMs: BOARD_PULSE_MS,
    };

    return state.lineClear;
  }

  function triggerAppearanceMorph(state) {
    state.appearanceMorph = {
      elapsedMs: 0,
      durationMs: APPEARANCE_MORPH_MS,
    };

    return state.appearanceMorph;
  }

  function tickEffect(effect, dt) {
    if (!effect) return null;

    effect.elapsedMs += dt;
    if (effect.elapsedMs >= effect.durationMs) {
      return null;
    }

    return effect;
  }

  function tickVisualEffects(state, dt) {
    state.hardDrop = tickEffect(state.hardDrop, dt);
    state.lineClear = tickEffect(state.lineClear, dt);
    state.boardPulse = tickEffect(state.boardPulse, dt);
    state.appearanceMorph = tickEffect(state.appearanceMorph, dt);
    return state;
  }

  function getProgress(effect) {
    if (!effect) return 1;
    return clamp01(effect.elapsedMs / effect.durationMs);
  }

  function getHardDropVisuals(effect) {
    if (!effect) {
      return { scaleBoost: 0, shiftPx: 0, glow: 0 };
    }

    const progress = getProgress(effect);
    const decay = 1 - progress;

    return {
      scaleBoost: Number((0.028 * effect.strength * decay).toFixed(4)),
      shiftPx: Number((10 * effect.strength * decay).toFixed(2)),
      glow: Number((0.85 * effect.strength * decay).toFixed(4)),
    };
  }

  function getLineClearVisuals(effect) {
    if (!effect) {
      return { rows: [], sweep: 1, alpha: 0, glow: 0 };
    }

    const progress = getProgress(effect);
    const decay = 1 - progress;

    return {
      rows: effect.rows.slice(),
      sweep: Number(progress.toFixed(4)),
      alpha: Number((0.42 + 0.58 * decay).toFixed(4)),
      glow: Number((0.72 * decay).toFixed(4)),
    };
  }

  function buildActionNotification({ actionLabel, b2bBonus, combo, linesCleared }) {
    const detailParts = [];

    if (b2bBonus) detailParts.push('BACK-TO-BACK!');
    if (combo >= 2) detailParts.push(`${combo}x COMBO`);

    let tone = 'normal';
    let durationMs = 1700;

    if ((actionLabel && actionLabel.indexOf('T-SPIN') === 0) || linesCleared === 4) {
      tone = 'critical';
      durationMs = 2100;
    } else if (linesCleared >= 2) {
      tone = 'strong';
      durationMs = 1800;
    }

    return {
      headline: actionLabel || '',
      detail: detailParts.join(' • '),
      tone,
      durationMs,
    };
  }

  function buildLevelUpNotification(level) {
    return {
      headline: `LEVEL ${level}!`,
      detail: 'Speed up',
      tone: 'level',
      durationMs: 1600,
    };
  }

  return {
    HARD_DROP_EFFECT_MS,
    LINE_CLEAR_EFFECT_MS,
    BOARD_PULSE_MS,
    APPEARANCE_MORPH_MS,
    buildActionNotification,
    buildLevelUpNotification,
    clamp01,
    createVisualEffectsState,
    getHardDropVisuals,
    getLineClearVisuals,
    triggerHardDropImpact,
    triggerLineClearSweep,
    triggerAppearanceMorph,
    tickVisualEffects,
  };
});
