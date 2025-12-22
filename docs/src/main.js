import Alpine from 'alpinejs';
import collapse from '@alpinejs/collapse';
import AlpineComponents from 'alpine-components';
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
    
    // Toggle highlight.js themes
    const themeLink = document.getElementById('hljs-theme');
    if (themeLink) {
      const darkHref = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/gruvbox-dark-medium.min.css';
      const lightHref = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/gruvbox-light-medium.min.css';
      themeLink.href = theme === 'dark' ? darkHref : lightHref;
    }
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

// Use plugins
Alpine.plugin(collapse);
Alpine.plugin(AlpineComponents({
  base: `${import.meta.env.BASE_URL}components`
}));

// Register components
Alpine.components.register('modal', 'modal/modal.html', 'modal/modal.js');
Alpine.components.register('tabs', 'tabs/tabs.html', 'tabs/tabs.js');
Alpine.components.register('codeBlock', 'code-block/code-block.html', 'code-block/code-block.js');
Alpine.components.register('demo', 'demo/demo.html', 'demo/demo.js');
Alpine.components.register('installTicker', 'install-ticker/install-ticker.html', 'install-ticker/install-ticker.js');
Alpine.components.register('search-modal', 'search-modal/search-modal.html');
Alpine.components.register('docs-actions', 'docs-actions/docs-actions.html');
Alpine.components.register('strategy-card', 'strategy-card/strategy-card.html');

// Stores
Alpine.store('theme', createThemeStore());
Alpine.store('theme').init();
registerSearch(Alpine);

// --- Highlight.js Logic ---
const initHighlighting = () => {
  if (!window.hljs) return;

  // Initial highlight
  window.hljs.highlightAll();

  // Watch for dynamic content (lazy-loaded components)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element
          const codeBlocks = node.querySelectorAll('pre code:not([data-highlighted="yes"])');
          codeBlocks.forEach((block) => {
            window.hljs.highlightElement(block);
          });
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

// Start Alpine
Alpine.start();

// Initialize highlighting after Alpine starts to ensure components are being watched
initHighlighting();
