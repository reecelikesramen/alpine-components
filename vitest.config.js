import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/build/**/*.test.js', 'packages/**/*.test.js'],
    alias: {
      '@alpine-components/core': resolve(__dirname, './packages/alpine-components/src/index.js'),
      '@alpine-components/vite-plugin': resolve(__dirname, './packages/vite-plugin/index.js'),
    },
  },
});

