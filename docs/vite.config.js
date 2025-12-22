import { defineConfig } from 'vite';
import { resolve } from 'path';
import handlebars from 'vite-plugin-handlebars';
import { componentAssetsPlugin } from 'vite-plugin-alpine-components';

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      'alpine-components': resolve(__dirname, '../packages/alpine-components/src/index.js')
    }
  },
  plugins: [
    handlebars({
      partialDirectory: resolve(__dirname, 'src/partials'),
      context: {
        title: 'Alpine Components',
        base: '/alpine-components/'
      },
      helpers: {
        eq: (a, b) => a === b
      }
    }),
    componentAssetsPlugin({
      src: 'src/components',
      dest: 'components'
    })
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        guide: resolve(__dirname, 'guide.html'),
        'loading-strategies': resolve(__dirname, 'loading-strategies.html'),
        slots: resolve(__dirname, 'slots.html'),
        'loading-states': resolve(__dirname, 'loading-states.html'),
        'vite-plugin': resolve(__dirname, 'vite-plugin.html'),
        api: resolve(__dirname, 'api.html'),
        credits: resolve(__dirname, 'credits.html'),
        license: resolve(__dirname, 'license.html')
      }
    }
  }
});
