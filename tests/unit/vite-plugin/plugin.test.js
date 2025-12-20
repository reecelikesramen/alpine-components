import { describe, it, expect, beforeEach, vi } from 'vitest';
import { componentAssetsPlugin } from '@alpine-components/vite-plugin';
import * as fs from 'node:fs/promises';

vi.mock('node:fs/promises', () => {
    const mocks = {
        readFile: vi.fn(),
        readdir: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn()
    };
    return {
        ...mocks,
        default: mocks
    };
});

describe('vite-plugin', () => {
    let plugin;

    beforeEach(() => {
        plugin = componentAssetsPlugin({
            src: 'src/components',
            dest: 'components'
        });
        plugin.configResolved({ 
            root: '/root', 
            command: 'serve', 
            base: '/',
            build: { outDir: 'dist' }
        });
        vi.clearAllMocks();
    });

    it('injects loading HTML into x-component elements', async () => {
        const html = '<div x-component="modal"></div>';
        const loadingHtml = '<div class="loading">...</div>';
        
        vi.mocked(fs.readFile).mockResolvedValue(loadingHtml);

        const result = await plugin.transformIndexHtml.handler(html);
        
        expect(result).toContain('data-loading-for="modal"');
        expect(result).toContain(loadingHtml);
        expect(result).toContain('x-component="modal"');
    });

    it('handles missing loading HTML gracefully', async () => {
        const html = '<div x-component="nonexistent"></div>';
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

        const result = await plugin.transformIndexHtml.handler(html);
        
        expect(result).not.toContain('data-loading-for="nonexistent"');
        expect(result).toBe(html);
    });
});

