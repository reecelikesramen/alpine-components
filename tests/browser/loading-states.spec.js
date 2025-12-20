const { test, expect } = require('@playwright/test');

test.describe('Loading States', () => {
    test('shows and removes loading state', async ({ page }) => {
        // Delay any request ending in loading.html
        await page.route(url => url.pathname.endsWith('loading.html'), async route => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await route.continue();
        });

        await page.goto('/pages/loading.html');

        const loadingState = page.locator('[data-loading-for="loading"]');
        await expect(loadingState).toBeVisible();
        await expect(loadingState).toContainText('Loading...');

        const component = page.locator('#loading-target');
        await expect(component).toContainText('Loaded Content');
        await expect(loadingState).not.toBeAttached();
    });
});

