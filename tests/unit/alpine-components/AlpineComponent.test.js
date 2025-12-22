/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AlpineComponents from '@alpine-components/core';

describe('Alpine.components', () => {
    let mockAlpine;

    beforeEach(() => {
        mockAlpine = {
            prefixed: vi.fn().mockReturnValue('x-ignore'),
            directive: vi.fn().mockReturnThis(),
            before: vi.fn().mockReturnThis(),
            magic: vi.fn().mockReturnThis(),
            initTree: vi.fn(),
            data: vi.fn()
        };
        AlpineComponents(mockAlpine);
        vi.restoreAllMocks();
    });

    it('registers components with template and js paths', () => {
        mockAlpine.components.register('test', 'test.html', 'test.js');
        const entry = mockAlpine.components._registry.get('test');
        expect(entry.templatePath).toBe('test.html');
        expect(entry.jsPath).toBe('test.js');
    });

    it('registers components with object syntax', () => {
        mockAlpine.components.register('test', { template: 'test.html', js: 'test.js' });
        const entry = mockAlpine.components._registry.get('test');
        expect(entry.templatePath).toBe('test.html');
        expect(entry.jsPath).toBe('test.js');
    });

    it('registers components without js path', () => {
        mockAlpine.components.register('test', 'test.html');
        const entry = mockAlpine.components._registry.get('test');
        expect(entry.templatePath).toBe('test.html');
        expect(entry.jsPath).toBeNull();
    });

    it('resolves paths with base option', () => {
        const plugin = AlpineComponents({ base: '/custom/' });
        plugin(mockAlpine);
        
        const resolved = mockAlpine.components._resolveWithBase('test.html', 'html');
        expect(resolved).toBe('/custom/test.html');
    });

    it('resolves paths with array base option', () => {
        const plugin = AlpineComponents({ base: ['/html/', '/js/'] });
        plugin(mockAlpine);
        
        expect(mockAlpine.components._resolveWithBase('test.html', 'html')).toBe('/html/test.html');
        expect(mockAlpine.components._resolveWithBase('test.js', 'js')).toBe('/js/test.js');
    });

    it('resolves alias with placeholders', () => {
        const plugin = AlpineComponents({ alias: '/components/[name]/[name].[ext]' });
        plugin(mockAlpine);
        
        const htmlPath = mockAlpine.components._resolveAlias('modal', 'html');
        const jsPath = mockAlpine.components._resolveAlias('modal', 'js');
        
        expect(htmlPath).toBe('/components/modal/modal.html');
        expect(jsPath).toBe('/components/modal/modal.js');
    });

    it('resolves alias with array pattern', () => {
        const plugin = AlpineComponents({ 
            alias: ['/templates/[name].html', '/scripts/[name].js'] 
        });
        plugin(mockAlpine);
        
        const htmlPath = mockAlpine.components._resolveAlias('modal', 'html');
        const jsPath = mockAlpine.components._resolveAlias('modal', 'js');
        
        expect(htmlPath).toBe('/templates/modal.html');
        expect(jsPath).toBe('/scripts/modal.js');
    });

    it('caches template fetches', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('<template><p>test</p></template>')
        });
        global.fetch = mockFetch;

        const p1 = mockAlpine.components._fetchTemplate('/test.html');
        const p2 = mockAlpine.components._fetchTemplate('/test.html');

        expect(p1).toBe(p2);
        await p1;
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('resolves paths with manifest', () => {
        global.window = { __AC_MANIFEST__: { 'test.html': 'test.123.html' } };
        const path = mockAlpine.components._resolvePath('test.html');
        expect(path).toBe('test.123.html');
        delete global.window;
    });

    describe('Placeholder Variations', () => {
        it('handles multiple [name] placeholders', () => {
            const plugin = AlpineComponents({ alias: '/comp/[name]/dir/[name].[ext]' });
            plugin(mockAlpine);
            expect(mockAlpine.components._resolveAlias('modal', 'html')).toBe('/comp/modal/dir/modal.html');
        });

        it('handles multiple [ext] placeholders', () => {
            const plugin = AlpineComponents({ alias: '/assets/[ext]/[name].[ext]' });
            plugin(mockAlpine);
            expect(mockAlpine.components._resolveAlias('modal', 'js')).toBe('/assets/js/modal.js');
        });

        it('handles no placeholders (static path)', () => {
            const plugin = AlpineComponents({ alias: '/static/component.html' });
            plugin(mockAlpine);
            expect(mockAlpine.components._resolveAlias('modal', 'html')).toBe('/static/component.html');
        });
    });

    describe('Options Priority and Edge Cases', () => {
        it('applies base to alias-resolved paths', () => {
            const plugin = AlpineComponents({ 
                base: '/base/',
                alias: 'comp/[name].[ext]'
            });
            plugin(mockAlpine);
            
            const paths = mockAlpine.components._resolveComponentPaths('modal');
            expect(paths.htmlPath).toBe('/base/comp/modal.html');
        });

        it('applies base to registered paths if they are relative', () => {
            const plugin = AlpineComponents({ base: '/base/' });
            plugin(mockAlpine);
            mockAlpine.components.register('modal', 'modal.html');
            
            const paths = mockAlpine.components._resolveComponentPaths('modal');
            expect(paths.htmlPath).toBe('/base/modal.html');
        });

        it('does not apply base to absolute registered paths', () => {
            const plugin = AlpineComponents({ base: '/base/' });
            plugin(mockAlpine);
            mockAlpine.components.register('modal', '/absolute/modal.html');
            
            const paths = mockAlpine.components._resolveComponentPaths('modal');
            expect(paths.htmlPath).toBe('/absolute/modal.html');
        });

        it('handles array base with array alias', () => {
            const plugin = AlpineComponents({ 
                base: ['/h/', '/j/'],
                alias: ['[name].html', '[name].js']
            });
            plugin(mockAlpine);
            
            const paths = mockAlpine.components._resolveComponentPaths('modal');
            expect(paths.htmlPath).toBe('/h/modal.html');
            expect(paths.jsPath).toBe('/j/modal.js');
        });
    });

    describe('Asset Extraction and Deduplication', () => {
        let headMock;
        
        beforeEach(() => {
            headMock = {
                appendChild: vi.fn(),
                querySelectorAll: vi.fn().mockReturnValue([])
            };
            Object.defineProperty(document, 'head', {
                value: headMock,
                configurable: true
            });
            // Reset registry and cache
            mockAlpine.components._registry.clear();
            mockAlpine.components._cache.clear();
            mockAlpine.components._loadedStyles.clear();
            mockAlpine.components._loadedScripts.clear();
        });

        it('deduplicates inline styles across instances', () => {
            const template = document.createElement('template');
            template.innerHTML = '<style>.test{color:red}</style><div></div>';
            
            // First time
            mockAlpine.components._extractAssets(template.content, 'comp');
            expect(headMock.appendChild).toHaveBeenCalledTimes(1);
            
            // Second time
            mockAlpine.components._extractAssets(template.content, 'comp');
            expect(headMock.appendChild).toHaveBeenCalledTimes(1);
        });

        it('deduplicates inline scripts across instances', () => {
            const template = document.createElement('template');
            template.innerHTML = '<script>window.test=1</script><div></div>';
            
            mockAlpine.components._extractAssets(template.content, 'comp');
            expect(headMock.appendChild).toHaveBeenCalledTimes(1);
            
            mockAlpine.components._extractAssets(template.content, 'comp');
            expect(headMock.appendChild).toHaveBeenCalledTimes(1);
        });

        it('handles scripts without src by creating new script tags', () => {
            const template = document.createElement('template');
            template.innerHTML = '<script>console.log(1)</script><div></div>';
            
            mockAlpine.components._extractAssets(template.content, 'comp');
            
            const appended = headMock.appendChild.mock.calls[0][0];
            expect(appended.tagName).toBe('SCRIPT');
            expect(appended.textContent).toBe('console.log(1)');
        });
    });

    it('detects direct HTML paths', () => {
        const result1 = mockAlpine.components._resolveComponentPaths('modal.html');
        expect(result1.htmlPath).toBe('modal.html');
        expect(result1.jsPath).toBeNull();

        const result2 = mockAlpine.components._resolveComponentPaths('/path/to/modal.html');
        expect(result2.htmlPath).toBe('/path/to/modal.html');
        expect(result2.jsPath).toBeNull();
    });

    it('looks up registry before alias', () => {
        mockAlpine.components.register('modal', 'custom/modal.html', 'custom/modal.js');
        
        const result = mockAlpine.components._resolveComponentPaths('modal');
        expect(result.htmlPath).toContain('custom/modal.html');
        expect(result.jsPath).toContain('custom/modal.js');
    });
});
