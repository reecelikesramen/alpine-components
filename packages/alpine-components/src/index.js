/**
 * Loading strategies for x-component directive
 */
const strategies = {
    eager: () => Promise.resolve(),

    visible: (el, margin = '0px') => new Promise(resolve => {
        let target = el;
        let cleanup = () => {};

        if (el.tagName === 'TEMPLATE') {
            // Prefer existing loading sibling injected by Vite plugin
            if (el.previousElementSibling && el.previousElementSibling.hasAttribute('data-loading-for')) {
                target = el.previousElementSibling;
            } else {
                // Create an invisible anchor to observe position accurately
                const anchor = document.createElement('div');
                anchor.style.display = 'block';
                anchor.style.width = '0';
                anchor.style.height = '0';
                anchor.style.overflow = 'hidden';
                anchor.ariaHidden = 'true';

                el.parentNode.insertBefore(anchor, el);
                target = anchor;
                cleanup = () => anchor.remove();
            }
        }

        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                observer.disconnect();
                cleanup();
                resolve();
            }
        }, { rootMargin: margin });
        
        observer.observe(target);
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
 * Find all top-level x-data elements with x-modelable attribute.
 * "Top-level" means no parent element with x-data within the component.
 * Returns an array of matching elements.
 */
function findModelableRoots(container) {
    const results = [];
    
    function walk(el) {
        for (const child of el.children) {
            if (child.hasAttribute('x-data')) {
                // This is a top-level x-data element
                if (child.hasAttribute('x-modelable')) {
                    results.push(child);
                }
                // Don't descend further - anything nested is not top-level
            } else {
                // Keep searching in non-x-data elements
                walk(child);
            }
        }
    }
    
    walk(container);
    return results;
}

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
            if (manifest[path]) {
                return path.startsWith('/') ? '/' + manifest[path] : manifest[path];
            }

            // Try stripping leading slash
            const noSlash = path.startsWith('/') ? path.slice(1) : path;
            if (manifest[noSlash]) {
                return path.startsWith('/') ? '/' + manifest[noSlash] : manifest[noSlash];
            }

            // Try adding leading slash
            const withSlash = path.startsWith('/') ? path : '/' + path;
            if (manifest[withSlash]) {
                return path.startsWith('/') ? '/' + manifest[withSlash] : manifest[withSlash];
            }

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
                    // Register all exported functions by their name
                    for (const [key, value] of Object.entries(module)) {
                        if (typeof value !== 'function') continue;
                        const fnName = value.name || (key !== 'default' ? key : name);
                        this._Alpine.data(fnName, value);
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

            // Search entire document for assets - DOMParser may place style/script in head
            await this._extractAssets(doc, name);

            return templateContent;
        },

        async _extractAssets(root, name) {
            const styles = root.querySelectorAll('style');
            styles.forEach((style, index) => {
                this._applyStyle(name, style.textContent, index);
            });

            const scripts = root.querySelectorAll('script');
            const scriptPromises = [];
            scripts.forEach((script, index) => {
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

        // Find the parent scope element for evaluation context
        // This must be captured BEFORE the template is replaced
        // First, look for nearest element with _x_component_params (parent component)
        // If not found, fall back to nearest element with _x_dataStack (x-data scope)
        let scopeEl = el.parentElement;
        while (scopeEl && !scopeEl._x_component_params && !scopeEl._x_dataStack) {
            scopeEl = scopeEl.parentElement;
        }
        // Fall back to parent if nothing found
        scopeEl = scopeEl || el.parentElement;

        // Extract params from element attributes (for <template x-component="...">)
        // Store expressions for reactive evaluation, not static values
        const paramExprs = {};
        let bindExpr = null;
        let modelExpr = null;
        const excludedAttrs = ['x-component', 'x-cloak', ignoreAttr];
        
        for (const attr of el.attributes) {
            if (excludedAttrs.includes(attr.name)) continue;

            if (attr.name === 'x-bind') {
                // x-bind="{ ... }" object syntax
                bindExpr = attr.value;
            } else if (attr.name === 'x-model') {
                // x-model="expr" for two-way binding
                modelExpr = attr.value;
            } else if (attr.name.startsWith(':') || attr.name.startsWith('x-bind:')) {
                const rawName = attr.name.startsWith(':') ? attr.name.slice(1) : attr.name.slice(7);
                paramExprs[rawName] = { expr: attr.value, dynamic: true };
            } else if (!attr.name.startsWith('x-')) {
                paramExprs[attr.name] = { value: attr.value, dynamic: false };
            }
        }

        // Create reactive proxy that re-evaluates expressions on access
        // Uses scopeEl for evaluation so it works after template replacement
        const params = new Proxy({}, {
            get(_, prop) {
                // Handle x-bind object spread first
                if (bindExpr) {
                    const bindObj = Alpine.evaluate(scopeEl, bindExpr);
                    if (bindObj && prop in bindObj) return bindObj[prop];
                }
                const entry = paramExprs[prop];
                if (!entry) return undefined;
                return entry.dynamic ? Alpine.evaluate(scopeEl, entry.expr) : entry.value;
            },
            ownKeys() {
                const keys = Object.keys(paramExprs);
                if (bindExpr) {
                    const bindObj = Alpine.evaluate(scopeEl, bindExpr);
                    if (bindObj) keys.push(...Object.keys(bindObj));
                }
                return [...new Set(keys)];
            },
            getOwnPropertyDescriptor(_, prop) {
                // Required for ownKeys to work properly
                if (paramExprs[prop]) return { enumerable: true, configurable: true };
                if (bindExpr) {
                    const bindObj = Alpine.evaluate(scopeEl, bindExpr);
                    if (bindObj && prop in bindObj) return { enumerable: true, configurable: true };
                }
                return undefined;
            }
        });

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

            // Capture loading sibling BEFORE any DOM replacement
            const loadingSibling = el.previousElementSibling;

            if (isTemplateEl) {
                // Replace template with unwrapped content
                const fragment = document.createRange().createContextualFragment(container.innerHTML);

                // Store params on the first element child for $params access
                const firstChild = fragment.firstElementChild;
                if (firstChild) {
                    firstChild._x_component_params = params;
                    firstChild._x_component = 'loaded';
                }

                // Forward x-model to all top-level x-data elements with x-modelable
                if (modelExpr) {
                    for (const target of findModelableRoots(fragment)) {
                        target.setAttribute('x-model', modelExpr);
                    }
                }

                el.replaceWith(fragment);

                // Remove loading sibling for template elements
                if (loadingSibling?.dataset?.loadingFor === componentName) {
                    loadingSibling.remove();
                }

                // Initialize the tree on the inserted elements
                if (firstChild) {
                    Alpine.initTree(firstChild);
                }
            } else {
                // Regular element: inject content inside
                el.innerHTML = container.innerHTML;
                el._x_component_params = params;

                // Forward x-model to all top-level x-data elements with x-modelable
                if (modelExpr) {
                    for (const target of findModelableRoots(el)) {
                        target.setAttribute('x-model', modelExpr);
                    }
                }

                // Activate: remove ignore and init tree
                el._x_ignore = false;
                el.removeAttribute(ignoreAttr);
                el.removeAttribute('x-cloak');
                el._x_component = 'loaded';

                Alpine.initTree(el);
            }

            // Remove loading sibling if present (for non-template elements; template case handled above)
            if (!isTemplateEl && loadingSibling?.dataset?.loadingFor === componentName) {
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
 *   Alpine.plugin(AlpineComponents)
 *   Alpine.plugin(AlpineComponents({ base: '/components/' }))
 */
export default function AlpineComponents(optionsOrAlpine) {
    if (isAlpine(optionsOrAlpine)) {
        // Called as Alpine.plugin(AlpineComponents)
        initPlugin(optionsOrAlpine, {});
        return;
    }

    // Called as Alpine.plugin(AlpineComponents({ ...options }))
    return (Alpine) => initPlugin(Alpine, optionsOrAlpine || {});
}

// Named exports for backwards compatibility and advanced usage
// ...
