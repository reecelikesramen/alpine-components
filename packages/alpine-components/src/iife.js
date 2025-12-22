import AlpineComponents from './index.js';

// Auto-register when Alpine is available
document.addEventListener('alpine:init', () => {
    Alpine.plugin(AlpineComponents);
});

export default AlpineComponents;
