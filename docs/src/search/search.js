import Fuse from 'fuse.js';
import searchIndex from './index.json';

const slugify = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

function ensureHeadingIds() {
  const headings = document.querySelectorAll('h1, h2, h3');
  const seen = new Map();

  for (const h of headings) {
    if (h.id) continue;

    const base = slugify(h.textContent);
    if (!base) continue;

    const used = seen.get(base) ?? 0;
    seen.set(base, used + 1);
    h.id = used === 0 ? base : `${base}-${used + 1}`;
  }
}

function createSearchStore(index) {
  const fuse = new Fuse(index.items, {
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    keys: [
      { name: 'title', weight: 0.55 },
      { name: 'pageTitle', weight: 0.25 },
      { name: 'content', weight: 0.2 }
    ]
  });

  return {
    isOpen: false,
    query: '',
    results: [],
    activeIndex: 0,

    init() {
      // Stable anchors for cross-page search links
      ensureHeadingIds();

      window.addEventListener('keydown', (e) => {
        const isK = (e.key || '').toLowerCase() === 'k';
        if (!isK) return;
        if (!e.metaKey && !e.ctrlKey) return;

        e.preventDefault();
        this.open();
      });
    },

    open() {
      this.isOpen = true;
      queueMicrotask(() => {
        document.getElementById('docs-search-input')?.focus();
        document.getElementById('docs-search-input')?.select?.();
      });
    },

    close() {
      this.isOpen = false;
      this.query = '';
      this.results = [];
      this.activeIndex = 0;
    },

    search() {
      const q = this.query.trim();
      if (!q) {
        this.results = [];
        this.activeIndex = 0;
        return;
      }

      this.results = fuse.search(q).slice(0, 12).map((r) => r.item);
      this.activeIndex = 0;
    },

    move(delta) {
      if (!this.results.length) return;
      const next = this.activeIndex + delta;
      if (next < 0) return;
      if (next >= this.results.length) return;
      this.activeIndex = next;
    },

    goActive() {
      const hit = this.results[this.activeIndex];
      if (!hit) return;
      window.location.href = hit.url;
      this.close();
    }
  };
}

export function registerSearch(Alpine) {
  Alpine.store('search', createSearchStore(searchIndex));
  Alpine.store('search').init();
}


