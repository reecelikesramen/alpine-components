import components from './index.js';

// Auto-register when Alpine is available
document.addEventListener('alpine:init', () => {
    Alpine.plugin(components);
});

export default components;
