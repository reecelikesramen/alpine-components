const { test, expect } = require('@playwright/test');

test.describe('Complex Model & Bind Scenarios', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pages/complex-model.html');
        await page.waitForSelector('.direct-model');
    });

    test('initial state propagates to all x-modelable targets', async ({ page }) => {
        // Parent has 'John'
        await expect(page.locator('#parent-name')).toHaveText('John');
        
        // 1. First top-level component root
        await expect(page.locator('.input-1')).toHaveValue('John');
        await expect(page.locator('.output-1')).toHaveText('John');
        
        // 2. Nested component root (sibling in template)
        await expect(page.locator('.input-2')).toHaveValue('John');
        await expect(page.locator('.output-2')).toHaveText('John');
    });

    test('parent update propagates down to all targets', async ({ page }) => {
        // Change parent name
        await page.click('#change-name');
        
        // Parent updated
        await expect(page.locator('#parent-name')).toHaveText('Jane');
        
        // Both component inputs updated
        await expect(page.locator('.input-1')).toHaveValue('Jane');
        await expect(page.locator('.input-2')).toHaveValue('Jane');
    });

    test('update from first component root propagates up and back down', async ({ page }) => {
        // Type in first input
        await page.locator('.input-1').fill('Mike');
        
        // Parent updated
        await expect(page.locator('#parent-name')).toHaveText('Mike');
        
        // Second input updated (via parent)
        await expect(page.locator('.input-2')).toHaveValue('Mike');
    });

    test('update from nested component root propagates up and back down', async ({ page }) => {
        // Type in second input
        await page.locator('.input-2').fill('Kate');
        
        // Parent updated
        await expect(page.locator('#parent-name')).toHaveText('Kate');
        
        // First input updated (via parent)
        await expect(page.locator('.input-1')).toHaveValue('Kate');
    });

    test('params (x-bind) are passed correctly', async ({ page }) => {
        // Check static param
        await expect(page.locator('.param-title')).toHaveText('Hello World');
        
        // Check dynamic param
        await expect(page.locator('.param-count')).toHaveText('0');
        
        // Update parent
        await page.click('#increment');
        
        // Check parent updated
        await expect(page.locator('#parent-count')).toHaveText('1');
        
        // Check component updated
        await expect(page.locator('.param-count')).toHaveText('1');
    });
});

