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

    event: (el, eventName, componentName) => new Promise(resolve => {
        // Named event: wait for a one-shot window event (e.g. `openModal`)
        if (eventName) {
            window.addEventListener(eventName, () => resolve(), { once: true });
            return;
        }

        // Default event: wait for a shared load event and match on detail.id
        // Example: window.dispatchEvent(new CustomEvent('alpine-components:load', { detail: { id: 'modal' }}))
        const defaultEvent = 'alpine-components:load';

        const handler = (e) => {
            const id = e?.detail?.id;
            if (id !== componentName) return;
            window.removeEventListener(defaultEvent, handler);
            resolve();
        };

        window.addEventListener(defaultEvent, handler);
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
        await strategies[strategyName](el, strategyArg, name);
        if (!el.isConnected) return;

        // Collect user-provided slot content
        const providedSlots = new Map();

        // Collect named slots from <slot name="..."> wrappers
        el.querySelectorAll('slot[name]').forEach(slotEl => {
            providedSlots.set(slotEl.getAttribute('name'), slotEl.innerHTML);
        });

        // Collect default slot: direct children excluding named slot wrappers
        const namedSlotEls = el.querySelectorAll('slot[name]');
        namedSlotEls.forEach(s => s.remove());
        const defaultContent = el.innerHTML.trim();
        if (defaultContent) providedSlots.set('default', defaultContent);

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

            // Validate template slots
            const templateSlots = container.querySelectorAll('slot');
            const validSlotNames = new Set();
            let defaultSlotCount = 0;
            const namedSlotCounts = new Map();

            templateSlots.forEach(slotEl => {
                const slotName = slotEl.getAttribute('name') || 'default';
                if (slotName === 'default') {
                    defaultSlotCount++;
                } else {
                    namedSlotCounts.set(slotName, (namedSlotCounts.get(slotName) || 0) + 1);
                }
                validSlotNames.add(slotName);
            });

            // Warn on duplicate default slots
            if (defaultSlotCount > 1) {
                console.warn(`[x-component="${name}"] Template has ${defaultSlotCount} default slots; only one allowed.`);
            }

            // Warn on duplicate named slots
            namedSlotCounts.forEach((count, slotName) => {
                if (count > 1) {
                    console.warn(`[x-component="${name}"] Template has ${count} slots named "${slotName}"; duplicates not allowed.`);
                }
            });

            // Validate provided content against template slots
            if (providedSlots.size > 0 && validSlotNames.size === 0) {
                console.warn(`[x-component="${name}"] Content provided but component has no slots; discarding.`);
                providedSlots.clear();
            } else {
                providedSlots.forEach((_, slotName) => {
                    if (!validSlotNames.has(slotName)) {
                        console.warn(`[x-component="${name}"] No slot "${slotName}" in template; discarding content.`);
                        providedSlots.delete(slotName);
                    }
                });
            }

            // Replace <slot> elements with provided content
            templateSlots.forEach(slotEl => {
                const slotName = slotEl.getAttribute('name') || 'default';
                const replacement = providedSlots.get(slotName);

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

