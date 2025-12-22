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
        if (eventName) {
            window.addEventListener(eventName, () => resolve(), { once: true });
            return;
        }

        const defaultEvent = 'alpine-components:load';
        const handler = (e) => {
            if (e?.detail?.id !== componentName) return;
            window.removeEventListener(defaultEvent, handler);
            resolve();
        };
        window.addEventListener(defaultEvent, handler);
    })
};

/**
 * Create the components object that gets attached to Alpine
 */
function createComponentsObject(options = {}) {
    const base = normalizeBaseOrAlias(options.base, '/components');
    const alias = normalizeBaseOrAlias(options.alias, null);

    return {
        _registry: new Map(),
        _cache: new Map(),
        _jsModules: new Map(),
        _loadedStyles: new Set(),
        _loadedScripts: new Map(), // Changed to Map to store promises
        _Alpine: null,
        _base: base,
        _alias: alias,

        register(name, templatePath, jsPath = null) {
            if (typeof templatePath === 'object' && templatePath !== null) {
                // register('modal', { template: '...', js: '...' })
                const opts = templatePath;
                this._registry.set(name, {
                    templatePath: opts.template || null,
                    jsPath: opts.js || null,
                    eager: opts.eager || false
                });
            } else {
                // register('modal', 'modal.html', 'modal.js')
                this._registry.set(name, {
                    templatePath: templatePath,
                    jsPath: jsPath || null,
                    eager: false
                });
            }

            const def = this._registry.get(name);
            if (def.eager) this._prefetch(name);
        },

        _resolvePath(path) {
            const manifest = typeof window !== 'undefined' && window.__AC_MANIFEST__;
            if (!manifest) return path;

            // Try exact match first
            if (manifest[path]) return manifest[path];

            // Try stripping leading slash
            const noSlash = path.startsWith('/') ? path.slice(1) : path;
            if (manifest[noSlash]) return manifest[noSlash];

            // Try adding leading slash
            const withSlash = path.startsWith('/') ? path : '/' + path;
            if (manifest[withSlash]) return manifest[withSlash];

            return path;
        },

        _resolveComponentPaths(nameOrPath) {
            // Direct HTML path: contains '/' or ends with '.html'
            if (nameOrPath.includes('/') || nameOrPath.endsWith('.html')) {
                return { htmlPath: nameOrPath, jsPath: null, name: null };
            }

            // Check registry first
            const def = this._registry.get(nameOrPath);
            if (def) {
                const htmlPath = this._resolveWithBase(def.templatePath, 'html');
                const jsPath = def.jsPath ? this._resolveWithBase(def.jsPath, 'js') : null;
                return { htmlPath, jsPath, name: nameOrPath };
            }

            // Fallback to alias resolution
            if (this._alias) {
                let htmlPath = this._resolveAlias(nameOrPath, 'html');
                let jsPath = this._resolveAlias(nameOrPath, 'js');

                if (htmlPath) htmlPath = this._resolveWithBase(htmlPath, 'html');
                if (jsPath) jsPath = this._resolveWithBase(jsPath, 'js');

                return { htmlPath, jsPath, name: nameOrPath };
            }

            // Fallback to base resolution
            const htmlPath = this._resolveWithBase(`${nameOrPath}.html`, 'html');
            return { htmlPath, jsPath: null, name: nameOrPath };
        },

        _resolveWithBase(path, type) {
            if (path.startsWith('/')) return path;

            const baseValue = Array.isArray(this._base)
                ? this._base[type === 'html' ? 0 : 1]
                : this._base;

            const normalizedBase = baseValue.endsWith('/') ? baseValue : baseValue + '/';
            return normalizedBase + path;
        },

        _resolveAlias(name, type) {
            const pattern = Array.isArray(this._alias)
                ? this._alias[type === 'html' ? 0 : 1]
                : this._alias;

            if (!pattern) return null;

            const ext = type === 'html' ? 'html' : 'js';
            return pattern
                .replace(/\[name\]/g, name)
                .replace(/\[ext\]/g, ext);
        },

        async _prefetch(name) {
            const { htmlPath, jsPath } = this._resolveComponentPaths(name);
            const promises = [this._fetchTemplate(htmlPath)];
            if (jsPath) promises.push(this._loadExternalJs(name, jsPath));
            await Promise.all(promises);
        },

        _fetchTemplate(path) {
            const resolved = this._resolvePath(path);
            if (this._cache.has(resolved)) return this._cache.get(resolved);

            const promise = fetch(resolved).then(res => {
                if (!res.ok) throw new Error(`Failed to fetch ${resolved}: ${res.status}`);
                return res.text();
            });
            this._cache.set(resolved, promise);
            return promise;
        },

        _loadExternalJs(name, path) {
            if (this._jsModules.has(name)) return this._jsModules.get(name);

            const resolved = this._resolvePath(path);
            const promise = import(/* @vite-ignore */ resolved).then(module => {
                const fn = module.default;
                if (fn && (!this._Alpine._data || !this._Alpine._data[name])) {
                    this._Alpine.data(name, fn);
                }
                return fn;
            });
            this._jsModules.set(name, promise);
            return promise;
        },

        _applyStyle(name, styleContent, index) {
            const key = `${name}-${index}`;
            if (this._loadedStyles.has(key)) return;
            this._loadedStyles.add(key);

            const style = document.createElement('style');
            style.setAttribute('data-component', name);
            style.setAttribute('data-index', index);
            style.textContent = styleContent;
            document.head.appendChild(style);
        },

        _applyScript(name, scriptEl, index) {
            const key = `${name}-${index}`;
            if (this._loadedScripts.has(key)) return this._loadedScripts.get(key);

            const isModule = scriptEl.getAttribute('type') === 'module';
            const content = scriptEl.textContent;

            let promise;
            if (isModule) {
                const blob = new Blob([content], { type: 'text/javascript' });
                const url = URL.createObjectURL(blob);
                promise = import(/* @vite-ignore */ url).then(module => {
                    URL.revokeObjectURL(url);
                    if (module.default) {
                        this._Alpine.data(name, module.default);
                    }
                    return module;
                }).catch(err => {
                    console.error(`Failed to import module for component ${name}:`, err);
                });
            } else {
                // Non-module script: inject into DOM
                const script = document.createElement('script');
                script.setAttribute('data-component', name);
                script.setAttribute('data-index', index);
                script.textContent = content;
                document.head.appendChild(script);
                promise = Promise.resolve();
            }

            this._loadedScripts.set(key, promise);
            return promise;
        },

        async _parseAndApplyAssets(name, html) {
            // Detect if we accidentally fetched a full HTML page (e.g. 404 fallback)
            const isFullHtml = /<html[^>]*>|<\!DOCTYPE/i.test(html);
            if (isFullHtml) {
                console.warn(`[alpine-components] Fetched content for "${name}" looks like a full HTML document. Did the fetch fail?`);
                return '';
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Extract template content
            const template = doc.querySelector('template');
            const templateContent = template ? template.innerHTML : html;

            await this._extractAssets(doc.body || doc, name);

            return templateContent;
        },

        async _extractAssets(root, name) {
            // Only extract from the provided root (usually doc.body for fragments)
            // to avoid picking up scripts/styles from the main document if something went wrong
            const styles = root.querySelectorAll('style');
            styles.forEach((style, index) => {
                this._applyStyle(name, style.textContent, index);
            });

            const scripts = root.querySelectorAll('script');
            const scriptPromises = [];
            scripts.forEach((script, index) => {
                // Skip if it's already an Alpine Component injected script
                if (script.hasAttribute('data-component')) return;
                
                scriptPromises.push(this._applyScript(name, script, index));
            });
            await Promise.all(scriptPromises);
        },

        async _resolve(nameOrPath, tuplePaths = null) {
            let htmlPath, jsPath, name;

            if (tuplePaths) {
                // Direct tuple: [htmlPath, jsPath]
                [htmlPath, jsPath] = tuplePaths;
                name = null;
            } else {
                const resolved = this._resolveComponentPaths(nameOrPath);
                htmlPath = resolved.htmlPath;
                jsPath = resolved.jsPath;
                name = resolved.name;
            }

            // Fetch template
            const rawHtml = await this._fetchTemplate(htmlPath);

            // Parse inline assets (style/script) and get template content
            const componentName = name || this._extractNameFromPath(htmlPath);
            const templateContent = await this._parseAndApplyAssets(componentName, rawHtml);

            // Load external JS if provided (and no inline script was found)
            if (jsPath && !this._loadedScripts.has(componentName)) {
                await this._loadExternalJs(componentName, jsPath);
            }

            return templateContent;
        },

        _extractNameFromPath(path) {
            const filename = path.split('/').pop();
            return filename.replace(/\.(html|htm)$/, '');
        }
    };
}

/**
 * Convert kebab-case to camelCase
 */
function kebabToCamel(str) {
    return str.replace(/-./g, x => x[1].toUpperCase());
}

/**
 * Normalize base or alias option to consistent format
 */
function normalizeBaseOrAlias(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    return value;
}

/**
 * Parse x-component expression to detect tuple syntax
 */
function parseExpression(expression) {
    const trimmed = expression.trim();

    // Check for array/tuple syntax: ['path.html', 'path.js'] or ["path.html", "path.js"]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed.replace(/'/g, '"'));
            if (Array.isArray(parsed) && parsed.length >= 1) {
                return { type: 'tuple', paths: parsed };
            }
        } catch {
            // Not valid JSON, treat as name
        }
    }

    return { type: 'name', value: trimmed };
}

/**
 * Initialize the plugin with Alpine instance
 */
function initPlugin(Alpine, options) {
    const componentsObj = createComponentsObject(options);
    componentsObj._Alpine = Alpine;

    // Attach to Alpine
    Alpine.components = componentsObj;

    // Register $params magic
    Alpine.magic('params', (el) => {
        // Walk up to find the component root with stored params
        let current = el;
        while (current) {
            if (current._x_component_params) {
                return current._x_component_params;
            }
            current = current.parentElement;
        }
        return {};
    });

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

        const parsed = parseExpression(expression);

        // Parse strategy from modifiers (default: eager)
        const strategyName = ['visible', 'event', 'eager'].find(s => modifiers.includes(s)) || 'eager';
        const strategyArg = modifiers.find(m => !['visible', 'event', 'eager'].includes(m));

        // Determine component name for strategies
        const componentName = parsed.type === 'tuple'
            ? componentsObj._extractNameFromPath(parsed.paths[0])
            : parsed.value;

        // Await strategy condition
        await strategies[strategyName](el, strategyArg, componentName);
        if (!el.isConnected) return;

        // Extract params from element attributes (for <template x-component="...">)
        const params = {};
        const excludedAttrs = ['x-component', 'x-cloak', ignoreAttr];
        for (const attr of el.attributes) {
            if (excludedAttrs.includes(attr.name)) continue;

            if (attr.name.startsWith(':') || attr.name.startsWith('x-bind:')) {
                const rawName = attr.name.startsWith(':') ? attr.name.slice(1) : attr.name.slice(7);
                const name = kebabToCamel(rawName);
                params[name] = Alpine.evaluate(el, attr.value);
            } else if (!attr.name.startsWith('x-')) {
                const name = kebabToCamel(attr.name);
                params[name] = attr.value;
            }
        }

        // Collect user-provided slot content
        const providedSlots = new Map();

        // Collect named slots from <slot name="..."> wrappers
        el.querySelectorAll('slot[name]').forEach(slotEl => {
            providedSlots.set(slotEl.getAttribute('name'), slotEl.innerHTML);
        });

        // Collect default slot: direct children excluding named slot wrappers
        const namedSlotEls = el.querySelectorAll('slot[name]');
        namedSlotEls.forEach(s => s.remove());

        // For template elements, get innerHTML; for other elements, same
        const defaultContent = el.innerHTML.trim();
        if (defaultContent) providedSlots.set('default', defaultContent);

        // Clear element while loading
        el.innerHTML = '';

        try {
            // Resolve and fetch component
            const templateHtml = parsed.type === 'tuple'
                ? await componentsObj._resolve(null, parsed.paths)
                : await componentsObj._resolve(parsed.value);

            if (!el.isConnected) return;

            // Create container to process slots
            const container = document.createElement('div');
            container.innerHTML = templateHtml;

            // Validate and process slots
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

            if (defaultSlotCount > 1) {
                console.warn(`[x-component="${componentName}"] Template has ${defaultSlotCount} default slots; only one allowed.`);
            }

            namedSlotCounts.forEach((count, slotName) => {
                if (count > 1) {
                    console.warn(`[x-component="${componentName}"] Template has ${count} slots named "${slotName}"; duplicates not allowed.`);
                }
            });

            if (providedSlots.size > 0 && validSlotNames.size === 0) {
                console.warn(`[x-component="${componentName}"] Content provided but component has no slots; discarding.`);
                providedSlots.clear();
            } else {
                providedSlots.forEach((_, slotName) => {
                    if (!validSlotNames.has(slotName)) {
                        console.warn(`[x-component="${componentName}"] No slot "${slotName}" in template; discarding content.`);
                        providedSlots.delete(slotName);
                    }
                });
            }

            // Replace <slot> elements with provided content
            templateSlots.forEach(slotEl => {
                const slotName = slotEl.getAttribute('name') || 'default';
                const replacement = providedSlots.get(slotName);

                const fragment = document.createRange().createContextualFragment(
                    replacement || slotEl.innerHTML
                );
                slotEl.replaceWith(fragment);
            });

            // Handle template vs regular element rendering
            const isTemplateEl = el.tagName === 'TEMPLATE';

            if (isTemplateEl) {
                // Replace template with unwrapped content
                const fragment = document.createRange().createContextualFragment(container.innerHTML);

                // Store params on the first element child for $params access
                const firstChild = fragment.firstElementChild;
                if (firstChild) {
                    firstChild._x_component_params = params;
                    firstChild._x_component = 'loaded';
                }

                el.replaceWith(fragment);

                // Initialize the tree on the inserted elements
                if (firstChild) {
                    Alpine.initTree(firstChild);
                }
            } else {
                // Regular element: inject content inside
                el.innerHTML = container.innerHTML;
                el._x_component_params = params;

                // Activate: remove ignore and init tree
                el._x_ignore = false;
                el.removeAttribute(ignoreAttr);
                el.removeAttribute('x-cloak');
                el._x_component = 'loaded';

                Alpine.initTree(el);
            }

            // Remove loading sibling if present
            const loadingSibling = isTemplateEl ? null : el.previousElementSibling;
            if (loadingSibling?.dataset.loadingFor === componentName) {
                loadingSibling.remove();
            }
        } catch (err) {
            console.error(`Failed to load component "${componentName}":`, err);
        }
    };

    asyncHandler.inline = syncHandler;

    Alpine.directive('component', asyncHandler).before('ignore');
}

/**
 * Detect if argument is Alpine instance or options
 */
function isAlpine(arg) {
    return arg && typeof arg.directive === 'function' && typeof arg.magic === 'function';
}

/**
 * Default export: components plugin
 *
 * Usage:
 *   Alpine.plugin(components)
 *   Alpine.plugin(components({ base: '/components/' }))
 */
export default function components(optionsOrAlpine) {
    if (isAlpine(optionsOrAlpine)) {
        // Called as Alpine.plugin(components)
        initPlugin(optionsOrAlpine, {});
        return;
    }

    // Called as Alpine.plugin(components({ ...options }))
    return (Alpine) => initPlugin(Alpine, optionsOrAlpine || {});
}

// Named exports for backwards compatibility and advanced usage
// ...
