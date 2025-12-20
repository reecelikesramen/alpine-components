import Alpine from 'alpinejs';
import persist from '@alpinejs/persist';
import collapse from '@alpinejs/collapse';
import { AlpineComponent, AlpineComponentPlugin } from 'alpine-components';
import { registerSearch } from './search/search.js';

function createThemeStore() {
  const storageKey = 'ac-docs-theme';

  const readMode = () => {
    try {
      const mode = localStorage.getItem(storageKey);
      if (mode === 'light' || mode === 'dark' || mode === 'auto') return mode;
      return 'auto';
    } catch (e) {
      return 'auto';
    }
  };

  const writeMode = (mode) => {
    try {
      localStorage.setItem(storageKey, mode);
    } catch (e) {
      // noop
    }
  };

  const resolveTheme = (mode) => {
    if (mode === 'light' || mode === 'dark') return mode;
    const prefersDark =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  };

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
  };

  return {
    mode: 'auto',
    _mql: null,

    init() {
      this.mode = readMode();

      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        this._mql = window.matchMedia('(prefers-color-scheme: dark)');
        this._mql.addEventListener?.('change', () => {
          if (this.mode !== 'auto') return;
          applyTheme(resolveTheme(this.mode));
        });
      }

      applyTheme(resolveTheme(this.mode));
    },

    setMode(mode) {
      if (mode !== 'auto' && mode !== 'light' && mode !== 'dark') return;

      this.mode = mode;
      writeMode(mode);
      applyTheme(resolveTheme(this.mode));
    },

    cycle() {
      if (this.mode === 'auto') return this.setMode('light');
      if (this.mode === 'light') return this.setMode('dark');
      return this.setMode('auto');
    },

    get resolved() {
      return resolveTheme(this.mode);
    }
  };
}

// Set base path for components (uses Vite's base config)
AlpineComponent.setBase(`${import.meta.env.BASE_URL}components`);

// Register components
AlpineComponent.register('modal', 'modal/modal.html', 'modal/modal.js');
AlpineComponent.register('tabs', 'tabs/tabs.html', 'tabs/tabs.js');
AlpineComponent.register('code-block', 'code-block/code-block.html', 'code-block/code-block.js');
AlpineComponent.register('demo', 'demo/demo.html', 'demo/demo.js');
AlpineComponent.register('installTicker', 'install-ticker/install-ticker.html', 'install-ticker/install-ticker.js');
AlpineComponent.register('search-modal', 'search-modal/search-modal.html');
AlpineComponent.register('docs-actions', 'docs-actions/docs-actions.html');
AlpineComponent.register('strategy-card', 'strategy-card/strategy-card.html');

// Use plugins
Alpine.plugin(collapse);
Alpine.plugin(persist);
Alpine.plugin(AlpineComponentPlugin);

// Stores
Alpine.store('theme', createThemeStore());
Alpine.store('theme').init();
registerSearch(Alpine);

// Init highlight.js
if (window.hljs) window.hljs.highlightAll();

Alpine.start();
