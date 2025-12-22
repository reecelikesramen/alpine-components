const { test, expect } = require('@playwright/test');

test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/pages/basic.html');
    });

    test('handles 404 for component template', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.evaluate(() => {
            const el = document.createElement('div');
            el.setAttribute('x-component', 'non-existent');
            el.id = 'error-404';
            document.body.appendChild(el);
            // Alpine will process it automatically because it's in document.body
        });

        await expect(async () => {
            expect(errors.some(e => e.includes('Failed to load component "non-existent"'))).toBe(true);
        }).toPass();
    });

    test('handles script errors in inline module', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.evaluate(() => {
            Alpine.components.register('broken-script', 'broken.html');
        });

        // Mock the fetch for broken.html
        await page.route('**/broken.html', route => {
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: `
                    <template><div>Broken</div></template>
                    <script type="module">
                        throw new Error("Module Load Error");
                    </script>
                `
            });
        });

        await page.evaluate(() => {
            const el = document.createElement('div');
            el.setAttribute('x-component', 'broken-script');
            document.body.appendChild(el);
        });

        await expect(async () => {
            expect(errors.some(e => e.includes('Module Load Error') || e.includes('Failed to load component'))).toBe(true);
        }).toPass();
    });
});

