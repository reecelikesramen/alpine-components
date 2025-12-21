const { test, expect } = require('@playwright/test');

test.describe('CDN and Script Varieties', () => {
    test('works with ESM import', async ({ page }) => {
        await page.goto('/pages/basic.html');
        // Clear previous script and use ESM
        await page.evaluate(() => {
            document.querySelectorAll('script').forEach(s => s.remove());
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                import Alpine from 'https://unpkg.com/alpinejs@3.x/dist/module.esm.js';
                import { AlpineComponentPlugin } from '/dist/module.esm.js';
                Alpine.plugin(AlpineComponentPlugin);
                Alpine.start();
                window.Alpine = Alpine;
            `;
            document.head.appendChild(script);
        });

        const target = page.locator('#simple-target');
        await expect(target).toContainText('Simple Component');
    });

    test('IIFE auto-registers plugin', async ({ page }) => {
        await page.goto('/pages/basic.html');
        const isRegistered = await page.evaluate(() => {
            return typeof window.AlpineComponent !== 'undefined';
        });
        expect(isRegistered).toBe(true);
    });
});

