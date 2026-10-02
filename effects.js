(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.TetrisEffects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const HARD_DROP_EFFECT_MS = 120;
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

  function triggerHardDropImpact(state, fromRow, toRow, cells = [], pieceType = 0) {
    const distance = Math.max(0, toRow - fromRow);
    const strength = Math.min(1, 0.35 + distance / 12);

    state.hardDrop = {
      fromRow,
      toRow,
      strength,
      cells: cells.map(cell => cell.slice()),
      pieceType,
      particles: [],
      elapsedMs: 0,
      durationMs: HARD_DROP_EFFECT_MS,
    };

    if (cells.length > 0) {
      const landingRow = Math.max(...cells.map(([row]) => row)) + 1;
      const left = Math.min(...cells.map(([, col]) => col));
      const right = Math.max(...cells.map(([, col]) => col)) + 1;
      state.hardDrop.particles = buildParticles(landingRow, left, right, pieceType, 3);
    }

    state.boardPulse = {
      strength: Math.max(0.5, strength * 0.85),
      elapsedMs: 0,
      durationMs: BOARD_PULSE_MS,
    };

    return state.hardDrop;
  }

  // Deterministic shards keep visual effects from consuming the game's bag RNG.
  function buildParticles(row, left, right, pieceType, count, rightPieceType = pieceType) {
    const particles = [];
    for (const direction of [-1, 1]) {
      for (let index = 0; index < count; index++) {
        particles.push({
          row,
          col: direction < 0 ? left : right,
          vx: direction * (0.006 + index * 0.002),
          vy: -0.003 - index * 0.0015,
          size: 0.12 + index * 0.035,
          pieceType: direction < 0 ? pieceType : rightPieceType,
        });
      }
    }
    return particles;
  }

  function triggerLineClearSweep(state, rows, board = [], combo = 0) {
    const strength = Math.min(1, 0.55 + rows.length * 0.08 + Math.max(0, combo) * 0.03);
    const snapshots = rows.map(row => ({ row, cells: (board[row] || []).slice() }));
    state.lineClear = {
      rows: rows.slice(),
      snapshots,
      strength,
      // At most 32 shards for the game's four-row clear; only one clear effect is retained.
      particles: snapshots.slice(0, 4).flatMap(({ row, cells }) => buildParticles(
        row + 0.5, 0, cells.length || 10, cells[0] || 0, 4, cells[cells.length - 1] || 0
      )),
      elapsedMs: 0,
      durationMs: LINE_CLEAR_EFFECT_MS,
    };

    state.boardPulse = {
      strength,
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
      scaleBoost: Number((0.006 * effect.strength * decay).toFixed(4)),
      shiftPx: Number((4 * effect.strength * decay).toFixed(2)),
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

  function getParticleVisuals(effect) {
    if (!effect) return [];
    const time = effect.elapsedMs;
    const alpha = Math.pow(1 - getProgress(effect), 2);
    return (effect.particles || []).map(particle => ({
      col: particle.col + particle.vx * time,
      row: particle.row + particle.vy * time + 0.000012 * time * time,
      size: particle.size,
      pieceType: particle.pieceType,
      alpha,
    }));
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
    getParticleVisuals,
    triggerHardDropImpact,
    triggerLineClearSweep,
    triggerAppearanceMorph,
    tickVisualEffects,
  };
});
