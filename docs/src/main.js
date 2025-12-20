import Alpine from 'alpinejs';
import { AlpineComponent, AlpineComponentPlugin } from 'alpine-components';

// Set base path for components (uses Vite's base config)
AlpineComponent.setBase(`${import.meta.env.BASE_URL}components`);

// Register components
AlpineComponent.register('modal', 'modal/modal.html', 'modal/modal.js');

// Use the plugin
Alpine.plugin(AlpineComponentPlugin);

Alpine.start();

