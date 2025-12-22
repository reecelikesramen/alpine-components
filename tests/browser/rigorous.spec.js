const { test, expect } = require('@playwright/test');

test.describe('Rigorous Component Testing', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pages/rigorous.html');
    });

    test('handles nested components and scoping', async ({ page }) => {
        const parent = page.locator('.nested-parent');
        await expect(parent).toBeVisible();
        await expect(parent.locator('h3')).toHaveText('Parent');

        const children = parent.locator('.nested-child');
        await expect(children).toHaveCount(2);
        await expect(children.nth(0)).toContainText('Label: Child 1');
        await expect(children.nth(1)).toContainText('Label: Child 2');
    });

    test('deduplicates inline assets across multiple instances', async ({ page }) => {
        const multi1 = page.locator('#multi-1').locator('.multi-asset');
        const multi2 = page.locator('#multi-2').locator('.multi-asset');

        await expect(multi1).toBeVisible();
        await expect(multi2).toBeVisible();

        // Check styles are applied (red color from inline style)
        await expect(multi1.locator('.asset-text-1')).toHaveCSS('color', 'rgb(255, 0, 0)');
        await expect(multi2.locator('.asset-text-1')).toHaveCSS('color', 'rgb(255, 0, 0)');

        // Verify script only ran once (using window.multiAssetLoaded incremented in fixture)
        const loadCount = await page.evaluate(() => window.multiAssetLoaded);
        expect(loadCount).toBe(1);

        // Verify module init ran for both
        await expect(multi1).toHaveAttribute('data-initialized', 'true');
        await expect(multi2).toHaveAttribute('data-initialized', 'true');
    });

    test('handles components without template tags (fallback to innerHTML)', async ({ page }) => {
        const component = page.locator('#no-template-1');
        await expect(component).toBeVisible();
        await expect(component).toContainText('This component has no template tag.');
        await expect(component).toContainText('Param: bar');
    });

    test('extracts attributes as $params correctly', async ({ page }) => {
        const component = page.locator('#params-1');
        const inner = component.locator('.params-tester');
        await expect(inner).toBeVisible();

        await expect(inner.locator('#param-text')).toHaveText('Hello Params');
        await expect(inner.locator('#param-count')).toHaveText('42');
        
        // Check binding to $params
        await expect(inner).toHaveAttribute('data-attr', 'some-attr');
        await expect(inner).toHaveClass(/custom-class/);

        // Check x-data initialization from $params
        await expect(inner.locator('#param-internal')).toHaveText('start');

        // Check update via $params
        await inner.locator('#param-action').click();
        await expect(inner.locator('#param-internal')).toHaveText('finished');
    });

    test('prevents style leaking (scoped styles via deduplication but still global CSS)', async ({ page }) => {
        const leak1 = page.locator('#leak-1');
        await expect(async () => {
            const state = await leak1.evaluate(el => el._x_component);
            expect(state).toBe('loaded');
        }).toPass();

        // Since we inject <style> into head, they are global. 
        // But we want to ensure they are only injected once.
        const styles = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('style[data-component="style-leak"]')).length;
        });
        expect(styles).toBe(1);
    });

    test('handles deep nesting (3+ levels) and param pass-through', async ({ page }) => {
        const root = page.locator('#deep-nest-root');
        await expect(root).toBeVisible();

        const l1 = root.locator('.deep-nest-1');
        const l2 = root.locator('.deep-nest-2');
        const l3 = root.locator('.deep-nest-3');

        await expect(l1.locator('p').first()).toHaveText('L1: root');
        await expect(l2.locator('p').first()).toHaveText('L2: root->L2');
        await expect(l3.locator('p').first()).toHaveText('L3: root->L2->L3');
    });
});

