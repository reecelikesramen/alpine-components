import { defineConfig } from 'vite';
import { componentAssetsPlugin } from './vite-plugin-component-assets.js';

export default defineConfig({
  plugins: [
    componentAssetsPlugin({
      src: 'src/components',
      dest: 'components'
    })
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        preserveModules: false
      }
    }
  }
});

