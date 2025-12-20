import Alpine from 'alpinejs';
import { AlpineComponent, AlpineComponentPlugin } from 'alpine-components';

// Register components
AlpineComponent.register('modal', 'modal/modal.html', 'modal/modal.js');

// Use the plugin
Alpine.plugin(AlpineComponentPlugin);

Alpine.start();

