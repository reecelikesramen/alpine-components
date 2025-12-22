const { test, expect } = require('@playwright/test');

test.describe('Reactive Params and x-model', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pages/reactive.html');
        // Wait for components to load - the reactive-input class comes from the component template
        await page.waitForSelector('#parent .reactive-input');
        await page.waitForSelector('#bind-parent .reactive-input');
    });

    test('$params re-evaluates when parent data changes', async ({ page }) => {
        const paramCount = page.locator('#parent #param-count');
        const parentCount = page.locator('#parent-count');
        
        // Initial state
        await expect(paramCount).toHaveText('0');
        await expect(parentCount).toHaveText('0');
        
        // Click increment button
        await page.click('#increment');
        
        // Both should update
        await expect(parentCount).toHaveText('1');
        await expect(paramCount).toHaveText('1');
        
        // Click again
        await page.click('#increment');
        await expect(parentCount).toHaveText('2');
        await expect(paramCount).toHaveText('2');
    });

    test('static params work without reactive evaluation', async ({ page }) => {
        const paramLabel = page.locator('#parent #param-label');
        await expect(paramLabel).toHaveText('static-label');
    });

    test('x-model forwards to x-modelable - initial state', async ({ page }) => {
        const input = page.locator('#parent #model-input');
        const parentName = page.locator('#parent-name');
        
        // Initial state - both empty
        await expect(input).toHaveValue('');
        await expect(parentName).toHaveText('');
    });

    test('x-model forwards to x-modelable - two-way binding', async ({ page }) => {
        const input = page.locator('#parent #model-input');
        const parentName = page.locator('#parent-name');
        
        // Type into the input
        await input.fill('hello');
        
        // Parent should update via x-modelable
        await expect(parentName).toHaveText('hello');
        
        // Type more
        await input.fill('hello world');
        await expect(parentName).toHaveText('hello world');
    });

    test('x-bind object syntax spreads properties into $params', async ({ page }) => {
        const paramCount = page.locator('#bind-parent #param-count');
        
        // :count="100" should take precedence over x-bind for 'count'
        await expect(paramCount).toHaveText('100');
    });
});

