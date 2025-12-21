/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlpineComponent } from '@alpine-components/core';

describe('AlpineComponent', () => {
    beforeEach(() => {
        AlpineComponent._registry.clear();
        AlpineComponent._cache.clear();
        AlpineComponent._jsModules.clear();
        AlpineComponent.setBase('/components');
        vi.restoreAllMocks();
    });

    it('sets base path correctly', () => {
        AlpineComponent.setBase('/custom/');
        expect(AlpineComponent._base).toBe('/custom');
        
        AlpineComponent.setBase('/another');
        expect(AlpineComponent._base).toBe('/another');
    });

    it('registers components', () => {
        AlpineComponent.register('test', 'test.html', 'test.js');
        const entry = AlpineComponent._registry.get('test');
        expect(entry.templatePath).toBe('/components/test.html');
        expect(entry.jsPath).toBe('/components/test.js');
    });

    it('normalizes paths during registration', () => {
        AlpineComponent.register('test', '/absolute.html');
        const entry = AlpineComponent._registry.get('test');
        expect(entry.templatePath).toBe('/absolute.html');
    });

    it('caches template fetches', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            text: () => Promise.resolve('<p>template</p>')
        });
        global.fetch = mockFetch;

        const p1 = AlpineComponent._fetchTemplate('/test.html');
        const p2 = AlpineComponent._fetchTemplate('/test.html');

        expect(p1).toBe(p2);
        const html = await p1;
        expect(html).toBe('<p>template</p>');
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('resolves paths with manifest', () => {
        global.window = { __AC_MANIFEST__: { 'test.html': 'test.123.html' } };
        const path = AlpineComponent._resolvePath('/components/test.html');
        expect(path).toBe('/components/test.123.html');
        delete global.window;
    });

    it('throws error for unregistered components', async () => {
        await expect(AlpineComponent._resolve('nonexistent'))
            .rejects.toThrow('Component "nonexistent" not registered');
    });
});

