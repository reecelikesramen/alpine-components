const { test, expect } = require('@playwright/test');

test.describe('Slot Behavior', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pages/slots.html');
    });

    test('replaces implicit default slot', async ({ page }) => {
        const target = page.locator('#slot-implicit');
        await expect(async () => {
            const state = await target.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();
        await expect(target.locator('main')).toContainText('Custom Content');
    });

    test('replaces named slots', async ({ page }) => {
        const target = page.locator('#slot-named');
        await expect(async () => {
            const state = await target.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();
        await expect(target.locator('header')).toContainText('Custom Header');
        await expect(target.locator('footer')).toContainText('Custom Footer');
        await expect(target.locator('main')).toContainText('Custom Body');
    });

    test('shows fallback content when no slot provided', async ({ page }) => {
        const target = page.locator('#slot-fallback');
        await expect(async () => {
            const state = await target.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();
        await expect(target.locator('header')).toContainText('Default Header');
        await expect(target.locator('main')).toContainText('Default Content');
        await expect(target.locator('footer')).toContainText('Default Footer');
    });

    test('warns on multiple default slots', async ({ page }) => {
        const logs = [];
        page.on('console', msg => logs.push(msg.text()));

        await page.waitForFunction(() => typeof window.Alpine?.components !== 'undefined');

        await page.evaluate(() => {
            window.Alpine.components.register('bad-slots', 'bad-slots/bad-slots.html');
        });

        await page.evaluate(() => {
            const el = document.createElement('div');
            el.setAttribute('x-component', 'bad-slots');
            document.body.appendChild(el);
        });

        // Wait for potential console warning
        await page.waitForTimeout(200);
        expect(logs.some(l => l.includes('default slots; only one allowed'))).toBe(true);
    });
});
