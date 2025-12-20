import { AlpineComponent, AlpineComponentPlugin } from './index.js';

// Attach to window
window.AlpineComponent = AlpineComponent;

// Auto-register when Alpine is available
document.addEventListener('alpine:init', () => {
    Alpine.plugin(AlpineComponentPlugin);
});

export { AlpineComponent, AlpineComponentPlugin };

