/**
 * Loading strategies for x-component directive
 */
const strategies = {
    eager: () => Promise.resolve(),

    visible: (el, margin = '0px') => new Promise(resolve => {
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                observer.disconnect();
                resolve();
            }
        }, { rootMargin: margin });
        observer.observe(el);
    }),

    event: (el, eventName) => new Promise(resolve => {
        if (!eventName) return resolve();
        window.addEventListener(eventName, () => resolve(), { once: true });
    })
};

/**
 * AlpineComponent - Lazy-loaded components with slots for Alpine.js
 */
export const AlpineComponent = {
    _registry: new Map(),
    _cache: new Map(),
    _jsModules: new Map(),
    _base: '/components',

    setBase(base) {
        this._base = base.endsWith('/') ? base.slice(0, -1) : base;
    },

    register(name, templatePath, jsPath = null, options = {}) {
        const resolvePath = (p) => p.startsWith('/') ? p : `${this._base}/${p}`;
        const resolvedTemplate = resolvePath(templatePath);
        const resolvedJs = jsPath ? resolvePath(jsPath) : null;
        this._registry.set(name, { templatePath: resolvedTemplate, jsPath: resolvedJs, options });
        if (options.eager) this._prefetch(name);
    },

    _resolvePath(path) {
        const manifest = typeof window !== 'undefined' && window.__AC_MANIFEST__;
        if (!manifest) return path;

        // Extract relative path from full path (remove base prefix)
        const baseWithSlash = this._base + '/';
        const relative = path.startsWith(baseWithSlash)
            ? path.slice(baseWithSlash.length)
            : path;

        const hashed = manifest[relative];
        if (!hashed) return path;

        // Replace filename with hashed version
        return path.replace(/[^/]+$/, hashed.split('/').pop());
    },

    async _prefetch(name) {
        const def = this._registry.get(name);
        if (!def) return;

        const promises = [this._fetchTemplate(def.templatePath)];
        if (def.jsPath) promises.push(this._loadJs(name, def.jsPath));
        await Promise.all(promises);
    },

    _fetchTemplate(path) {
        const resolved = this._resolvePath(path);
        if (this._cache.has(resolved)) return this._cache.get(resolved);

        const promise = fetch(resolved).then(res => res.text());
        this._cache.set(resolved, promise);
        return promise;
    },

    _loadJs(name, path) {
        if (this._jsModules.has(name)) return this._jsModules.get(name);

        const resolved = this._resolvePath(path);
        const promise = import(/* @vite-ignore */ resolved).then(module => {
            const fn = module.default;
            if (!this._Alpine._data || !this._Alpine._data[name]) {
                this._Alpine.data(name, fn);
            }
            return fn;
        });
        this._jsModules.set(name, promise);
        return promise;
    },

    async _resolve(name) {
        const def = this._registry.get(name);
        if (!def) throw new Error(`Component "${name}" not registered`);

        const [html] = await Promise.all([
            this._fetchTemplate(def.templatePath),
            def.jsPath ? this._loadJs(name, def.jsPath) : Promise.resolve()
        ]);
        return html;
    }
};

/**
 * Alpine.js plugin for x-component directive
 */
export function AlpineComponentPlugin(Alpine) {
    AlpineComponent._Alpine = Alpine;
    const ignoreAttr = Alpine.prefixed('ignore');

    // Sync handler: runs immediately to prevent tree walking
    const syncHandler = (el) => {
        if (el._x_component) return;
        el._x_component = 'init';
        el._x_ignore = true;
        el.setAttribute(ignoreAttr, '');
        el.setAttribute('x-cloak', '');
    };

    // Async handler: loads and activates component
    const asyncHandler = async (el, { expression, modifiers }) => {
        if (el._x_component !== 'init') return;
        el._x_component = 'loading';

        const name = expression;

        // Parse strategy from modifiers (default: eager)
        const strategyName = ['visible', 'event', 'eager'].find(s => modifiers.includes(s)) || 'eager';
        const strategyArg = modifiers.find(m => !['visible', 'event', 'eager'].includes(m));

        // Await strategy condition
        await strategies[strategyName](el, strategyArg);
        if (!el.isConnected) return;

        // Collect slot content from <slot name="..."> elements
        const slots = new Map();
        el.querySelectorAll('slot[name]').forEach(slotEl => {
            slots.set(slotEl.getAttribute('name'), slotEl.innerHTML);
        });

        // Collect unnamed <slot> or direct children as default slot
        const defaultSlot = el.querySelector('slot:not([name])');
        if (defaultSlot) {
            slots.set('default', defaultSlot.innerHTML);
        } else if (!slots.size) {
            const defaultContent = el.innerHTML.trim();
            if (defaultContent) slots.set('default', defaultContent);
        }

        // Clear element while loading
        el.innerHTML = '';

        try {
            const templateHtml = await AlpineComponent._resolve(name);
            if (!el.isConnected) return;

            // Parse the template
            const parser = new DOMParser();
            const doc = parser.parseFromString(templateHtml, 'text/html');
            const template = doc.querySelector('template');
            const content = template ? template.innerHTML : templateHtml;

            // Create a container to process slots
            const container = document.createElement('div');
            container.innerHTML = content;

            // Replace <slot> elements with provided content
            container.querySelectorAll('slot').forEach(slotEl => {
                const slotName = slotEl.getAttribute('name') || 'default';
                const replacement = slots.get(slotName);

                if (replacement) {
                    const fragment = document.createRange().createContextualFragment(replacement);
                    slotEl.replaceWith(fragment);
                } else {
                    const fragment = document.createRange().createContextualFragment(slotEl.innerHTML);
                    slotEl.replaceWith(fragment);
                }
            });

            // Inject processed content
            el.innerHTML = container.innerHTML;

            // Activate: remove ignore and init tree
            el._x_ignore = false;
            el.removeAttribute(ignoreAttr);
            el.removeAttribute('x-cloak');
            el._x_component = 'loaded';

            Alpine.initTree(el);

            // Remove loading sibling if present
            const loadingSibling = el.previousElementSibling;
            if (loadingSibling?.dataset.loadingFor === name) {
                loadingSibling.remove();
            }
        } catch (err) {
            console.error(`Failed to load component "${name}":`, err);
        }
    };

    asyncHandler.inline = syncHandler;

    Alpine.directive('component', asyncHandler).before('ignore');
}

