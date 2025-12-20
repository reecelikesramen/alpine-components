/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlpineComponentPlugin, AlpineComponent } from '@alpine-components/core';

describe('AlpineComponentPlugin', () => {
    let mockAlpine;

    beforeEach(() => {
        mockAlpine = {
            prefixed: vi.fn().mockReturnValue('x-ignore'),
            directive: vi.fn().mockReturnThis(),
            before: vi.fn().mockReturnThis(),
            initTree: vi.fn(),
            data: vi.fn()
        };
        AlpineComponent._registry.clear();
        vi.restoreAllMocks();
    });

    it('registers x-component directive', () => {
        AlpineComponentPlugin(mockAlpine);
        expect(mockAlpine.directive).toHaveBeenCalledWith('component', expect.any(Function));
    });

    it('sync handler sets initial state', () => {
        AlpineComponentPlugin(mockAlpine);
        const asyncHandler = mockAlpine.directive.mock.calls[0][1];
        const syncHandler = asyncHandler.inline;
        
        const el = document.createElement('div');
        syncHandler(el);

        expect(el._x_component).toBe('init');
        expect(el._x_ignore).toBe(true);
        expect(el.getAttribute('x-ignore')).toBe('');
        expect(el.hasAttribute('x-cloak')).toBe(true);
    });

    it('async handler ignores already loading elements', async () => {
        AlpineComponentPlugin(mockAlpine);
        const asyncHandler = mockAlpine.directive.mock.calls[0][1];
        
        const el = document.createElement('div');
        el._x_component = 'loading';
        
        await asyncHandler(el, { expression: 'test', modifiers: [] });
        expect(el._x_component).toBe('loading');
    });
});

