const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const gameJs = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

test('screens and canvases expose accessible semantics', () => {
  for (const id of ['screen-start', 'screen-options', 'screen-pause', 'screen-gameover']) {
    assert.match(
      html,
      new RegExp(`<div id="${id}"[^>]*role="dialog"[^>]*aria-modal="true"`),
      `${id} is missing dialog semantics`
    );
  }

  for (const id of ['canvas-board', 'canvas-hold', 'canvas-next']) {
    assert.match(
      html,
      new RegExp(`<canvas id="${id}"[^>]*aria-label="[^"]+"`),
      `${id} is missing an accessible name`
    );
  }

  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="game-instructions" class="visually-hidden"/);
  assert.match(html, /id="game-status" class="visually-hidden"/);
});

test('every cached runtime element exists and runtime dependencies load first', () => {
  const cachedIds = Array.from(gameJs.matchAll(/getElementById\('([^']+)'\)/g), match => match[1]);
  assert.ok(cachedIds.length > 0);
  for (const id of cachedIds) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} is cached but missing from index.html`);
  }

  assert.ok(html.indexOf('src="game-engine.js"') < html.indexOf('src="game.js"'));
  assert.ok(html.indexOf('src="game-input.js"') < html.indexOf('src="game.js"'));
});

test('touch controls cover every essential game action', () => {
  for (const action of [
    'move-left',
    'move-right',
    'soft-drop',
    'hard-drop',
    'rotate-cw',
    'rotate-ccw',
    'hold',
    'pause',
  ]) {
    assert.match(html, new RegExp(`data-game-action="${action}"`));
  }

  assert.match(css, /\.mobile-controls\s*\{[\s\S]*display:\s*none;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.mobile-controls\s*\{[\s\S]*display:\s*block;/);
});

test('reduced-motion and visible keyboard focus styles are provided', () => {
  assert.match(css, /button:focus-visible\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('bright primary buttons meet normal-text contrast at both gradient ends', () => {
  for (const style of ['fluent', 'material', 'cupertino', 'shadcn', 'atlassian']) {
    const block = findThemeBlock('bright', style);
    const text = getHexToken(block, '--button-primary-text');
    const start = getHexToken(block, '--button-primary-start');
    const end = getHexToken(block, '--button-primary-end');

    assert.ok(contrastRatio(text, start) >= 4.5, `${style} gradient start is too low contrast`);
    assert.ok(contrastRatio(text, end) >= 4.5, `${style} gradient end is too low contrast`);
  }
});

function findThemeBlock(theme, style) {
  const marker = `:root[data-theme="${theme}"][data-style="${style}"]`;
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `${style} ${theme} theme block missing`);
  const openBrace = css.indexOf('{', start);
  const closeBrace = css.indexOf('}', openBrace);
  return css.slice(openBrace + 1, closeBrace);
}

function getHexToken(block, name) {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `${name} missing or not a six-digit hex color`);
  return match[1];
}

function contrastRatio(first, second) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map(value => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
