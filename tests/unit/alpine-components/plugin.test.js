/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import components from '@alpine-components/core';

describe('components plugin', () => {
    let mockAlpine;

    beforeEach(() => {
        mockAlpine = {
            prefixed: vi.fn().mockReturnValue('x-ignore'),
            directive: vi.fn().mockReturnThis(),
            before: vi.fn().mockReturnThis(),
            magic: vi.fn().mockReturnThis(),
            initTree: vi.fn(),
            data: vi.fn()
        };
        vi.restoreAllMocks();
    });

    it('registers x-component directive when called directly', () => {
        components(mockAlpine);
        expect(mockAlpine.directive).toHaveBeenCalledWith('component', expect.any(Function));
    });

    it('registers x-component directive when called with options', () => {
        const plugin = components({ base: '/custom/' });
        plugin(mockAlpine);
        expect(mockAlpine.directive).toHaveBeenCalledWith('component', expect.any(Function));
    });

    it('attaches components object to Alpine', () => {
        components(mockAlpine);
        expect(mockAlpine.components).toBeDefined();
        expect(mockAlpine.components._registry).toBeInstanceOf(Map);
    });

    it('registers $params magic', () => {
        components(mockAlpine);
        expect(mockAlpine.magic).toHaveBeenCalledWith('params', expect.any(Function));
    });

    it('sync handler sets initial state', () => {
        components(mockAlpine);
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
        components(mockAlpine);
        const asyncHandler = mockAlpine.directive.mock.calls[0][1];
        
        const el = document.createElement('div');
        el._x_component = 'loading';
        
        await asyncHandler(el, { expression: 'test', modifiers: [] });
        expect(el._x_component).toBe('loading');
    });
});
