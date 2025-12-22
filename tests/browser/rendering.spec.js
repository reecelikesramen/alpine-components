const { test, expect } = require('@playwright/test');

test.describe('Basic Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pages/basic.html');
    });

    test('renders simple component', async ({ page }) => {
        const component = page.locator('#simple-target');
        
        // Wait for state to be loaded
        await expect(async () => {
            const state = await component.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();

        await expect(component).toBeVisible();
        await expect(component).toContainText('Simple Component');
        
        // Verify x-cloak is removed
        const hasCloak = await component.evaluate(el => el.hasAttribute('x-cloak'));
        expect(hasCloak).toBe(false);
    });

    test('renders component with JS and handles interaction', async ({ page }) => {
        await page.waitForFunction(() => typeof window.Alpine?.components !== 'undefined');

        await page.evaluate(() => {
            const el = document.createElement('div');
            el.setAttribute('x-component', 'withJs');
            el.id = 'js-target';
            document.body.appendChild(el);
        });

        const component = page.locator('#js-target');
        
        // Wait for state to be loaded
        await expect(async () => {
            const state = await component.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();

        await expect(component).toBeVisible();
        await expect(component.locator('p')).toHaveText('Component with JS');

        const count = page.locator('#count');
        await expect(count).toHaveText('0');

        await page.click('#counter');
        await expect(count).toHaveText('1');
    });
});
