(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.TetrisThemeOptions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MODE_LABELS = {
    dark: 'Dark',
    bright: 'Bright',
  };

  const OPTIONS_PANEL_COPY = {
    subtitle: 'Choose a theme and compare it on a fixed game snapshot.',
    modeTitle: 'Mode',
    modeCopy: 'Switch brightness without leaving the same theme grid.',
    themesTitle: 'Themes',
    themesCopy: 'Compare the same game snapshot across all themes.',
  };

  const STYLE_OPTION_CONFIG = {
    fluent: {
      label: 'Glass',
      summary: 'Glossy layers and cool contrast.',
    },
    material: {
      label: 'Bloom',
      summary: 'Colorful depth with warmer energy.',
    },
    cupertino: {
      label: 'Calm',
      summary: 'Soft contrast and quiet spacing.',
    },
    shadcn: {
      label: 'Mono',
      summary: 'Neutral contrast and crisp structure.',
    },
    atlassian: {
      label: 'Focus',
      summary: 'Clear blue accents and product-like density.',
    },
  };

  function normalizeMode(mode) {
    return mode === 'bright' ? 'bright' : 'dark';
  }

  function buildAppearanceSummaryLabel(style, mode) {
    const config = STYLE_OPTION_CONFIG[style] || STYLE_OPTION_CONFIG.fluent;
    return `${config.label} · ${MODE_LABELS[normalizeMode(mode)]}`;
  }

  function buildThemeMiniPreviewMarkup(style) {
    return [
      `<span class="theme-mini theme-mini--${style}">`,
      '<span class="theme-mini__hud">',
      '<span class="theme-mini__hold">',
      '<span class="theme-mini__hold-piece"></span>',
      '</span>',
      '<span class="theme-mini__next">',
      '<span class="theme-mini__next-piece"></span>',
      '<span class="theme-mini__next-piece"></span>',
      '</span>',
      '</span>',
      '<span class="theme-mini__board">',
      '<span class="theme-mini__stack"></span>',
      '<span class="theme-mini__ghost"></span>',
      '<span class="theme-mini__current"></span>',
      '</span>',
      '</span>',
    ].join('');
  }

  function buildThemeCardMarkup(style, mode, isSelected) {
    const model = getThemeCardViewModel(style, mode, isSelected);

    return [
      `<button type="button" class="preset-card${model.isSelected ? ' is-selected' : ''}" data-style-value="${model.style}" aria-pressed="${String(model.isSelected)}">`,
      `<span class="preset-card__name">${model.label}</span>`,
      `<span class="preset-card__preview preset-card__preview--${model.style}" aria-hidden="true">${model.previewMarkup}</span>`,
      '</button>',
    ].join('');
  }

  function buildThemeCardsMarkup(mode, activeStyle) {
    return Object.keys(STYLE_OPTION_CONFIG)
      .map(style => buildThemeCardMarkup(style, mode, style === activeStyle))
      .join('');
  }

  function getThemeCardViewModel(style, mode, isSelected) {
    const config = STYLE_OPTION_CONFIG[style] || STYLE_OPTION_CONFIG.fluent;

    return {
      style,
      mode: normalizeMode(mode),
      label: config.label,
      summary: config.summary,
      isSelected: !!isSelected,
      previewMarkup: buildThemeMiniPreviewMarkup(style),
    };
  }

  return {
    MODE_LABELS,
    OPTIONS_PANEL_COPY,
    STYLE_OPTION_CONFIG,
    buildAppearanceSummaryLabel,
    buildThemeCardMarkup,
    buildThemeCardsMarkup,
    buildThemeMiniPreviewMarkup,
    getThemeCardViewModel,
  };
});
