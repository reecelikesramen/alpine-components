import Fuse from 'fuse.js';

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

function createSearchStore() {
  return {
    isOpen: false,
    query: '',
    results: [],
    activeIndex: 0,
    isLoading: false,
    isReady: false,
    error: null,
    _fuse: null,

    async init() {
      // Stable anchors for cross-page search links
      ensureHeadingIds();

      await this._loadIndex();

      window.addEventListener('keydown', (e) => {
        const isK = (e.key || '').toLowerCase() === 'k';
        if (!isK) return;
        if (!e.metaKey && !e.ctrlKey) return;

        e.preventDefault();
        this.open();
      });
    },

    async _loadIndex() {
      this.isLoading = true;
      this.isReady = false;
      this.error = null;

      try {
        const base = import.meta.env.BASE_URL || '/';
        const url = `${base}search/index.json`;
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`Failed to load search index (${res.status})`);
        const index = await res.json();

        this._fuse = new Fuse(index.items ?? [], {
          includeScore: true,
          threshold: 0.35,
          ignoreLocation: true,
          keys: [
            { name: 'title', weight: 0.55 },
            { name: 'pageTitle', weight: 0.25 },
            { name: 'content', weight: 0.2 }
          ]
        });

        this.isReady = true;
      } catch (e) {
        this.error = e?.message || String(e);
        this._fuse = null;
      } finally {
        this.isLoading = false;
      }
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

      if (!this._fuse) {
        this.results = [];
        this.activeIndex = 0;
        return;
      }

      this.results = this._fuse.search(q).slice(0, 12).map((r) => r.item);
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
  Alpine.store('search', createSearchStore());
  Alpine.store('search').init();
}


