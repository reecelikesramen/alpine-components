import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'node:fs';
import { componentAssetsPlugin } from '../packages/vite-plugin/index.js';

export default defineConfig({
  root: resolve(__dirname, 'fixtures'),
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [resolve(__dirname, '..')]
    }
  },
  plugins: [
    {
      name: 'serve-dist',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.startsWith('/dist/')) {
            const filePath = resolve(__dirname, '../packages/alpine-components', req.url.slice(1));
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/javascript');
              res.end(fs.readFileSync(filePath));
              return;
            }
          }
          next();
        });
      }
    },
    componentAssetsPlugin({
      src: 'components',
      dest: 'components'
    })
  ]
});

