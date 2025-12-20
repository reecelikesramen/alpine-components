import { defineConfig } from 'vite';
import { componentAssetsPlugin } from 'vite-plugin-alpine-components';

export default defineConfig({
  base: '/alpine-components/',
  plugins: [
    componentAssetsPlugin({
      src: 'src/components',
      dest: 'components'
    })
  ],
  build: {
    sourcemap: true
  }
});

