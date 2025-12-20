import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJs } from 'terser';

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  minifyCSS: true,
  minifyJS: true
};

/**
 * Vite plugin to handle component assets (HTML/JS) without bundling.
 * - Dev: serves files from src at the configured dest path
 * - Build: copies and minifies files to dist with source maps
 * - Injects {component}.loading.html into x-component elements
 */
export function componentAssetsPlugin(options = {}) {
  const { src = 'src/components', dest = 'components' } = options;

  let rootDir;
  let isBuild = false;

  // Cache for loading HTML content
  const loadingCache = new Map();

  async function getLoadingHtml(componentName) {
    if (loadingCache.has(componentName)) return loadingCache.get(componentName);

    const loadingPath = join(rootDir, src, componentName, `${componentName}.loading.html`);
    try {
      const content = await readFile(loadingPath, 'utf-8');
      loadingCache.set(componentName, content.trim());
      return content.trim();
    } catch {
      loadingCache.set(componentName, null);
      return null;
    }
  }

  async function injectLoadingHtml(html) {
    const regex = /<[^>]+\sx-component="([^"]+)"[^>]*>/g;

    // Collect all component names to prefetch loading HTML
    const matches = [...html.matchAll(regex)];
    const componentNames = [...new Set(matches.map(m => m[1]))];
    await Promise.all(componentNames.map(getLoadingHtml));

    // Replace with callback - inject loading as previous sibling
    return html.replace(regex, (fullTag, componentName) => {
      const loadingHtml = loadingCache.get(componentName);
      if (!loadingHtml) return fullTag;
      const wrappedLoading = `<div data-loading-for="${componentName}">${loadingHtml}</div>`;
      return wrappedLoading + fullTag;
    });
  }

  return {
    name: 'vite-plugin-alpine-components',

    configResolved(config) {
      rootDir = config.root;
      isBuild = config.command === 'build';
    },

    // Transform index.html: inject loading HTML and minify
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        html = await injectLoadingHtml(html);
        if (!isBuild) return html;
        return minifyHtml(html, HTML_MINIFY_OPTIONS);
      }
    },

    // Dev: serve component files at /dest/... from src/...
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith(`/${dest}/`)) return next();

        const relativePath = url.slice(dest.length + 2); // strip /dest/
        const filePath = join(rootDir, src, relativePath);

        try {
          const content = await readFile(filePath, 'utf-8');
          const ext = filePath.split('.').pop();

          const contentType = ext === 'html' ? 'text/html'
            : ext === 'js' ? 'application/javascript'
            : 'text/plain';

          res.setHeader('Content-Type', contentType);
          res.end(content);
        } catch {
          next();
        }
      });
    },

    // Build: copy and minify component files
    async closeBundle() {
      if (!isBuild) return;

      const srcDir = join(rootDir, src);
      const outDir = join(rootDir, 'dist', dest);

      await processDirectory(srcDir, outDir, srcDir);
    }
  };
}

async function processDirectory(dir, outDir, baseDir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(dir, entry.name);
    const relativePath = relative(baseDir, srcPath);
    const destPath = join(outDir, relativePath);

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await processDirectory(srcPath, outDir, baseDir);
      continue;
    }

    const ext = entry.name.split('.').pop();
    if (ext !== 'html' && ext !== 'js') continue;
    if (entry.name.endsWith('.loading.html')) continue;

    await mkdir(dirname(destPath), { recursive: true });
    const content = await readFile(srcPath, 'utf-8');

    if (ext === 'html') {
      const minified = await minifyHtml(content, HTML_MINIFY_OPTIONS);
      await writeFile(destPath, minified);
    } else if (ext === 'js') {
      const result = await minifyJs(content, {
        sourceMap: {
          filename: entry.name,
          url: `${entry.name}.map`
        },
        compress: true,
        mangle: true
      });
      await writeFile(destPath, result.code);
      if (result.map) {
        await writeFile(`${destPath}.map`, result.map);
      }
    }
  }
}

