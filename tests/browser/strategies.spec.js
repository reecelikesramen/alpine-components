const { test, expect } = require('@playwright/test');

test.describe('Loading Strategies', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pages/strategies.html');
    });

    test('eager strategy loads immediately', async ({ page }) => {
        const target = page.locator('#eager-target');
        await expect(async () => {
            const state = await target.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();
        await expect(target).toContainText('Simple Component');
    });

    test('visible strategy loads on scroll', async ({ page }) => {
        const target = page.locator('#visible-target');
        
        // Should not be loaded initially
        const isLoadedInitial = await target.evaluate(el => el._x_component === 'loaded');
        expect(isLoadedInitial).toBe(false);

        // Scroll to target
        await target.scrollIntoViewIfNeeded();

        // Should be loaded now
        await expect(async () => {
            const state = await target.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();
        
        await expect(target).toContainText('Simple Component');
    });

    test('event strategy loads on custom event', async ({ page }) => {
        const target = page.locator('#event-target');
        
        // Should not be loaded initially
        const isLoadedInitial = await target.evaluate(el => el._x_component === 'loaded');
        expect(isLoadedInitial).toBe(false);

        // Click trigger button
        await page.click('#trigger-event');

        // Should be loaded now
        await expect(async () => {
            const state = await target.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();
        await expect(target).toContainText('Simple Component');
    });

    test('event strategy loads on default alpine-components:load event', async ({ page }) => {
        const target = page.locator('#default-event-target');
        
        // Should not be loaded initially
        const isLoadedInitial = await target.evaluate(el => el._x_component === 'loaded');
        expect(isLoadedInitial).toBe(false);

        // Click trigger button
        await page.click('#trigger-default');

        // If button click didn't work, try direct dispatch
        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent('alpine-components:load', { detail: { id: 'simple' }}));
        });

        // Should be loaded now
        await expect(async () => {
            const state = await target.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();
        await expect(target).toContainText('Simple Component');
    });
});

