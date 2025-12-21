# alpine-components

[![Publish Package](https://github.com/reecelikesramen/alpine-components/actions/workflows/publish.yml/badge.svg)](https://github.com/reecelikesramen/alpine-components/actions/workflows/publish.yml)
![NPM Version](https://img.shields.io/npm/v/alpine-components)
![NPM Version](https://img.shields.io/npm/v/vite-plugin-alpine-components)

Lazy-loaded components with slots for Alpine.js — plus a Vite plugin to serve/minify component assets and inject loading states.

## Contributors

- Reece Holmdahl ([@reecelikesramen](https://github.com/reecelikesramen))

## Inspired by

- [Async Alpine](https://async-alpine.dev/)
- [Alpine AJAX](https://alpine-ajax.js.org/)

## Packages

- **`alpine-components`**: runtime + component registry  
  See `packages/alpine-components/README.md`
- **`vite-plugin-alpine-components`**: Vite plugin for dev/build component assets  
  See `packages/vite-plugin/README.md`

## Development

```bash
pnpm install
```

Build the library:

```bash
pnpm -C packages/alpine-components build
```

Run docs locally:

```bash
pnpm -C docs dev
```

## License

MIT


