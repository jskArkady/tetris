const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  OPTIONS_PANEL_COPY,
  STYLE_OPTION_CONFIG,
  buildAppearanceSummaryLabel,
  buildThemeMiniPreviewMarkup,
  buildThemeCardsMarkup,
  getThemeCardViewModel,
} = require('../theme-options.js');

test('style option config uses simplified feel-based names', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(STYLE_OPTION_CONFIG).map(([key, value]) => [key, value.label])
    ),
    {
      fluent: 'Glass',
      material: 'Bloom',
      cupertino: 'Calm',
      shadcn: 'Mono',
      atlassian: 'Focus',
    }
  );
});

test('style option config summaries keep the theme comparison copy', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(STYLE_OPTION_CONFIG).map(([key, value]) => [key, value.summary])
    ),
    {
      fluent: 'Glossy layers and cool contrast.',
      material: 'Colorful depth with warmer energy.',
      cupertino: 'Soft contrast and quiet spacing.',
      shadcn: 'Neutral contrast and crisp structure.',
      atlassian: 'Clear blue accents and product-like density.',
    }
  );
});

test('options panel copy is centralized for the options screen', () => {
  assert.deepEqual(OPTIONS_PANEL_COPY, {
    subtitle: 'Choose a theme and compare it on a fixed game snapshot.',
    modeTitle: 'Mode',
    modeCopy: 'Switch brightness without leaving the same theme grid.',
    themesTitle: 'Themes',
    themesCopy: 'Compare the same game snapshot across all themes.',
  });
});

test('appearance summary label keeps theme name primary and mode secondary', () => {
  assert.equal(
    buildAppearanceSummaryLabel('material', 'bright'),
    'Bloom · Bright'
  );
});

test('theme card view model exposes preview markup with board, hold, and next regions', () => {
  const model = getThemeCardViewModel('fluent', 'dark', true);

  assert.equal(model.label, 'Glass');
  assert.equal(model.isSelected, true);
  assert.match(model.previewMarkup, /theme-mini__hold/);
  assert.match(model.previewMarkup, /theme-mini__board/);
  assert.match(model.previewMarkup, /theme-mini__next/);
});

test('theme mini preview markup includes the fixed mini-game snapshot nodes', () => {
  const markup = buildThemeMiniPreviewMarkup('fluent');

  assert.match(markup, /theme-mini__hud/);
  assert.match(markup, /theme-mini__stack/);
  assert.match(markup, /theme-mini__current/);
  assert.match(markup, /theme-mini__ghost/);
  assert.match(markup, /theme-mini__next-piece/);
});

test('theme mini preview scene structure is reused across themes', () => {
  const normalize = markup => markup.replace(/theme-mini--[a-z]+/g, 'theme-mini--style');

  assert.equal(
    normalize(buildThemeMiniPreviewMarkup('fluent')),
    normalize(buildThemeMiniPreviewMarkup('shadcn'))
  );
});

test('theme cards markup renders simplified card-first labels for the selected style', () => {
  const markup = buildThemeCardsMarkup('dark', 'material');

  assert.match(markup, /data-style-value="material"/);
  assert.match(markup, /class="preset-card is-selected"/);
  assert.match(markup, />Bloom</);
  assert.doesNotMatch(markup, />Material 3</);
  assert.doesNotMatch(markup, />Google</);
});

test('theme cards markup excludes the old large preview block', () => {
  const markup = buildThemeCardsMarkup('dark', 'fluent');

  assert.doesNotMatch(markup, /Current Selection/);
  assert.doesNotMatch(markup, /appearance-preview/);
});

test('runtime wiring keeps theme metadata centralized and renders the grid container', () => {
  const gameJs = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  assert.match(indexHtml, /id="preset-grid"/);
  assert.doesNotMatch(indexHtml, /appearance-preview/);
  assert.match(gameJs, /ThemeOptions\.buildAppearanceSummaryLabel\(/);
  assert.match(gameJs, /ThemeOptions\.STYLE_OPTION_CONFIG/);
  assert.doesNotMatch(gameJs, /dom\.presetCards\s*=/);
});

test('stylesheet provides bright-mode preview overrides for preset cards', () => {
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

  for (const style of ['fluent', 'material', 'cupertino', 'shadcn', 'atlassian']) {
    assert.match(
      styleCss,
      new RegExp(String.raw`(?::root|body)\[data-theme="bright"\](?:\[data-style="${style}"\])?[^{}]*\.preset-card\[data-style-value="${style}"\][^{]*\{[^}]*--preview-bg-start:[^;]+;`, 'm'),
      `${style} bright-mode preview override missing`
    );
    assert.match(
      styleCss,
      new RegExp(String.raw`(?::root|body)\[data-theme="bright"\](?:\[data-style="${style}"\])?[^{}]*\.preset-card\[data-style-value="${style}"\][^{]*\{[^}]*--preview-border:[^;]+;[^}]*--preview-panel:[^;]+;[^}]*--preview-accent:[^;]+;[^}]*--preview-highlight:[^;]+;`, 'm'),
      `${style} bright-mode preview tokens incomplete`
    );
  }
});

test('mobile overlay styles bound the screen content and allow vertical scrolling', () => {
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const mobileBlockStart = styleCss.indexOf('@media (max-width: 600px)');

  assert.ok(mobileBlockStart >= 0, 'mobile media query missing');
  const mobileBlock = styleCss.slice(mobileBlockStart);

  assert.match(mobileBlock, /\.screen\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.match(mobileBlock, /\.screen__content\s*\{[\s\S]*max-height:\s*calc\(100dvh - 40px\);[\s\S]*overflow-y:\s*auto;/);
});

test('mode toggles update selection without re-rendering the preset grid', () => {
  const vm = require('node:vm');
  const effects = require('../effects.js');

  const modeButtons = [createButton('dark'), createButton('bright')];
  const elements = new Map();
  const ids = [
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
    'btn-play-again',
    'btn-open-options-gameover',
  ];

  for (const id of ids) {
    elements.set(id, id === 'preset-grid' ? createPresetGrid() : createElement(id));
  }
  elements.get('canvas-board').getContext = createCanvasContext;
  elements.get('canvas-hold').getContext = createCanvasContext;
  elements.get('canvas-next').getContext = createCanvasContext;

  let cardMarkupCalls = 0;
  const themeOptions = {
    ...require('../theme-options.js'),
    buildThemeCardsMarkup(...args) {
      cardMarkupCalls++;
      return require('../theme-options.js').buildThemeCardsMarkup(...args);
    },
  };

  const context = {
    window: null,
    document: null,
    localStorage: createLocalStorage(),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    console,
    performance: { now: () => 0 },
    setTimeout,
    clearTimeout,
    TetrisEffects: effects,
    TetrisThemeOptions: themeOptions,
  };
  context.window = context;
  context.document = createDocument(elements, modeButtons);
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.getComputedStyle = context.getComputedStyle;
  context.window.requestAnimationFrame = context.requestAnimationFrame;
  context.window.cancelAnimationFrame = context.cancelAnimationFrame;
  context.window.performance = context.performance;
  context.window.setTimeout = setTimeout;
  context.window.clearTimeout = clearTimeout;
  context.window.TetrisEffects = effects;
  context.window.TetrisThemeOptions = themeOptions;

  const gameJs = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  vm.runInNewContext(gameJs, context, { filename: 'game.js' });

  assert.equal(context.document._listeners.DOMContentLoaded.length, 1);
  context.document._listeners.DOMContentLoaded[0]();

  assert.equal(cardMarkupCalls, 1);
  assert.ok(modeButtons[0].classList.contains('is-selected'));
  assert.equal(modeButtons[0].getAttribute('aria-pressed'), 'true');

  modeButtons[1].click();

  assert.equal(cardMarkupCalls, 1);
  assert.ok(modeButtons[1].classList.contains('is-selected'));
  assert.equal(modeButtons[1].getAttribute('aria-pressed'), 'true');
  assert.ok(!modeButtons[0].classList.contains('is-selected'));
  assert.equal(modeButtons[0].getAttribute('aria-pressed'), 'false');

  const presetGrid = elements.get('preset-grid');
  const cards = presetGrid.querySelectorAll('.preset-card');
  const selectedCard = cards.find(card => card.dataset.styleValue === 'material');
  const neighborCard = cards.find(card => card.dataset.styleValue === 'fluent');

  assert.ok(selectedCard);
  assert.ok(neighborCard);
  assert.strictEqual(presetGrid.renderCount, 1);

  presetGrid.dispatchEvent({
    type: 'click',
    target: selectedCard,
    currentTarget: presetGrid,
    preventDefault() {},
  });

  assert.equal(cardMarkupCalls, 1);
  assert.strictEqual(presetGrid.renderCount, 1);
  assert.strictEqual(presetGrid.querySelectorAll('.preset-card')[1], cards[1]);
  assert.ok(selectedCard.classList.contains('is-selected'));
  assert.equal(selectedCard.getAttribute('aria-pressed'), 'true');
  assert.ok(!neighborCard.classList.contains('is-selected'));
  assert.equal(neighborCard.getAttribute('aria-pressed'), 'false');

  modeButtons[0].click();

  assert.equal(cardMarkupCalls, 1);
  assert.strictEqual(presetGrid.renderCount, 1);
  assert.strictEqual(presetGrid.querySelectorAll('.preset-card')[1], cards[1]);
  assert.ok(selectedCard.classList.contains('is-selected'));
  assert.equal(selectedCard.getAttribute('aria-pressed'), 'true');
  assert.ok(!neighborCard.classList.contains('is-selected'));
  assert.equal(neighborCard.getAttribute('aria-pressed'), 'false');
});

function createLocalStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function createDocument(elements, modeButtons) {
  const listeners = {};
  const documentElement = createElement('html');
  const body = createElement('body');

  return {
    documentElement,
    body,
    _listeners: listeners,
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector === '.mode-chip') return modeButtons;
      return [];
    },
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
  };
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

function createButton(mode) {
  const button = createElement('button');
  button.dataset.modeValue = mode;
  return button;
}

function createPresetGrid() {
  const grid = createElement('div');
  let cards = createPresetCards();
  let renderCount = 0;

  Object.defineProperty(grid, 'renderCount', {
    get() {
      return renderCount;
    },
  });

  Object.defineProperty(grid, 'innerHTML', {
    get() {
      return grid._innerHTML || '';
    },
    set(value) {
      grid._innerHTML = String(value);
      renderCount++;
      cards = createPresetCards();
    },
  });

  grid.querySelectorAll = selector => {
    if (selector === '.preset-card') return cards;
    return [];
  };

  return grid;
}

function createPresetCards() {
  return Object.keys(STYLE_OPTION_CONFIG).map(style => createPresetCard(style));
}

function createPresetCard(style) {
  const card = createElement('button');
  card.dataset.styleValue = style;
  card.closest = selector => (selector === '.preset-card' ? card : null);
  return card;
}

function createElement(tagName) {
  const listeners = {};
  const attributes = new Map();
  const classSet = new Set();
  const styleStore = new Map();
  let innerHTMLValue = '';

  const element = {
    tagName: String(tagName).toUpperCase(),
    dataset: {},
    style: {
      setProperty(name, value) {
        styleStore.set(name, String(value));
      },
      removeProperty(name) {
        styleStore.delete(name);
      },
    },
    classList: {
      add(...classes) {
        classes.forEach(cls => classSet.add(cls));
      },
      remove(...classes) {
        classes.forEach(cls => classSet.delete(cls));
      },
      toggle(cls, force) {
        if (force === true) {
          classSet.add(cls);
          return true;
        }
        if (force === false) {
          classSet.delete(cls);
          return false;
        }
        if (classSet.has(cls)) {
          classSet.delete(cls);
          return false;
        }
        classSet.add(cls);
        return true;
      },
      contains(cls) {
        return classSet.has(cls);
      },
    },
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
    dispatchEvent(event) {
      const handlers = listeners[event.type] || [];
      handlers.forEach(handler => handler.call(element, event));
      return true;
    },
    querySelectorAll() {
      return [];
    },
    click() {
      this.dispatchEvent({
        type: 'click',
        target: element,
        currentTarget: element,
        preventDefault() {},
      });
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
  };

  Object.defineProperty(element, 'innerHTML', {
    configurable: true,
    get() {
      return innerHTMLValue;
    },
    set(value) {
      innerHTMLValue = String(value);
    },
  });

  Object.defineProperty(element, 'textContent', {
    configurable: true,
    get() {
      return element._textContent || '';
    },
    set(value) {
      element._textContent = String(value);
    },
  });

  return element;
}
