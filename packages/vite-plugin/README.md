# vite-plugin-alpine-components

Vite plugin for [alpine-components](https://www.npmjs.com/package/alpine-components).

## Features

- **Dev**: Serves component files from source at the configured path
- **Build**: Minifies HTML/JS with source maps
- **Loading states**: Injects `{component}.loading.html` into `x-component` elements

## Installation

```bash
npm install -D vite-plugin-alpine-components
```

## Usage

```js
// vite.config.js
import { defineConfig } from 'vite';
import { componentAssetsPlugin } from 'vite-plugin-alpine-components';

export default defineConfig({
  plugins: [
    componentAssetsPlugin({
      src: 'src/components',  // Where your component files live
      dest: 'components'       // URL path to serve/build them at
    })
  ]
});
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `src` | `'src/components'` | Source directory for component files |
| `dest` | `'components'` | URL path prefix for serving components |

## Loading States

Create a `{component}.loading.html` file next to your component to show a loading state:

```
src/components/
  modal/
    modal.html
    modal.js
    modal.loading.html   # Shows while modal is loading
```

The loading HTML is injected as a sibling element and automatically removed when the component loads.

## License

MIT

