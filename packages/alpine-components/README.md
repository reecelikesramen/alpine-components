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

