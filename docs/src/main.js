import Alpine from 'alpinejs';
import collapse from '@alpinejs/collapse';
import { AlpineComponent, AlpineComponentPlugin } from 'alpine-components';

// Set base path for components (uses Vite's base config)
AlpineComponent.setBase(`${import.meta.env.BASE_URL}components`);

// Register components
AlpineComponent.register('modal', 'modal/modal.html', 'modal/modal.js');
AlpineComponent.register('tabs', 'tabs/tabs.html', 'tabs/tabs.js');
AlpineComponent.register('code-block', 'code-block/code-block.html', 'code-block/code-block.js');
AlpineComponent.register('demo', 'demo/demo.html', 'demo/demo.js');

// Use plugins
Alpine.plugin(collapse);
Alpine.plugin(AlpineComponentPlugin);

Alpine.start();
