# alpine-components

Lazy-loaded components with slots for Alpine.js.

## Installation

```bash
npm install alpine-components alpinejs
```

## Usage

```js
import Alpine from 'alpinejs';
import { AlpineComponent, AlpineComponentPlugin } from 'alpine-components';

// Register components
AlpineComponent.register('modal', 'modal/modal.html', 'modal/modal.js');

// Use the plugin
Alpine.plugin(AlpineComponentPlugin);

Alpine.start();
```

```html
<div x-component="modal">
  <slot name="header">
    <p><strong>Custom Header</strong></p>
  </slot>
</div>
```

## Loading Strategies

Control when components load using modifiers:

```html
<!-- Eager (default) - loads immediately -->
<div x-component="modal"></div>
<div x-component.eager="modal"></div>

<!-- Visible - loads when element enters viewport -->
<div x-component.visible="modal"></div>
<div x-component.visible.100px="modal"></div>  <!-- with root margin -->

<!-- Event - loads on named event -->
<div x-component.event.openModal="modal"></div>

<!-- Event - loads on alpine-component:load with matching detail.id -->
<div x-component.event="modal"></div>
<button @click="$dispatch('alpine-component:load', { id: 'modal' })">Load Modal</button>
```

## API

### `AlpineComponent.setBase(base)`

Set the base path for component files. Default: `/components`

### `AlpineComponent.register(name, templatePath, jsPath?, options?)`

Register a component.

- `name` - Component name used in `x-component="name"`
- `templatePath` - Path to the HTML template
- `jsPath` - Optional path to the JS module (exports Alpine data function)
- `options.eager` - Prefetch the component immediately

## License

MIT

