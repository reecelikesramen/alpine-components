import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from 'vite';
import { resolve } from 'path';
import { readdir, readFile, rm } from 'node:fs/promises';
import { componentAssetsPlugin } from '@alpine-components/vite-plugin';

describe('Build Output', () => {
    const root = resolve(__dirname, '../fixtures');
    const outDir = resolve(root, 'dist-test');

    beforeEach(async () => {
        try {
            await rm(outDir, { recursive: true, force: true });
        } catch (e) {}
    });

    afterEach(async () => {
        try {
            await rm(outDir, { recursive: true, force: true });
        } catch (e) {}
    });

    it('hashes component files and generates manifest', async () => {
        await build({
            root,
            build: {
                outDir,
                lib: false,
                rollupOptions: {
                    input: resolve(root, 'pages/basic.html')
                }
            },
            plugins: [
                componentAssetsPlugin({
                    src: 'components',
                    dest: 'components'
                })
            ]
        });

        const componentsDir = resolve(outDir, 'components');
        
        // Check for hashed html file in simple/
        const simpleFiles = await readdir(resolve(componentsDir, 'simple'));
        const simpleHtml = simpleFiles.find(f => f.startsWith('simple.') && f.endsWith('.html'));
        expect(simpleHtml).toBeDefined();
        expect(simpleHtml.split('.')).toHaveLength(3); // simple.{hash}.html

        // Check for hashed js file in withJs/
        const withJsFiles = await readdir(resolve(componentsDir, 'withJs'));
        const withJs = withJsFiles.find(f => f.startsWith('withJs.') && f.endsWith('.js'));
        expect(withJs).toBeDefined();

        // Check manifest injection
        const indexHtml = await readFile(resolve(outDir, 'pages/basic.html'), 'utf-8');
        expect(indexHtml).toContain('window.__AC_MANIFEST__');
        expect(indexHtml).toContain('simple.html');
        expect(indexHtml).toContain(simpleHtml);
    });

    it('excludes loading.html from build output', async () => {
        await build({
            root,
            build: {
                outDir,
                lib: false,
                rollupOptions: {
                    input: resolve(root, 'pages/basic.html')
                }
            },
            plugins: [
                componentAssetsPlugin({
                    src: 'components',
                    dest: 'components'
                })
            ]
        });

        const componentsDir = resolve(outDir, 'components');
        const files = await readdir(componentsDir, { recursive: true });
        const hasLoading = files.some(f => f.includes('.loading.html'));
        expect(hasLoading).toBe(false);
    });
});

