import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJs } from 'terser';

function contentHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

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
  let outDirRoot;
  let isBuild = false;
  let basePath = '/';

  // Cache for loading HTML content
  const loadingCache = new Map();

  // Manifest mapping original paths to hashed paths (build only)
  const manifest = {};

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
      outDirRoot = config.build.outDir;
      isBuild = config.command === 'build';
      basePath = config.base || '/';
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

    // Dev: serve component files at {base}{dest}/... from src/...
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        const prefix = `${basePath}${dest}/`.replace(/\/+/g, '/');
        if (!url?.startsWith(prefix)) return next();

        const relativePath = url.slice(prefix.length);
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

    // Build: copy and minify component files with content hashing
    async closeBundle() {
      if (!isBuild) return;

      const srcDir = resolve(rootDir, src);
      const outDir = resolve(rootDir, outDirRoot, dest);

      await processDirectory(srcDir, outDir, srcDir, manifest);

      // Inject manifest into all built HTML files
      if (Object.keys(manifest).length === 0) return;

      const script = `<script>window.__AC_MANIFEST__=${JSON.stringify(manifest)};</script>`;
      await injectManifestIntoHtmlFiles(resolve(rootDir, outDirRoot), script);
    }
  };
}

async function injectManifestIntoHtmlFiles(dir, script) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await injectManifestIntoHtmlFiles(fullPath, script);
      continue;
    }

    if (!entry.name.endsWith('.html')) continue;

    try {
      let html = await readFile(fullPath, 'utf-8');
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${script}`);
        await writeFile(fullPath, html);
      }
    } catch {
      // Skip files that can't be read/written
    }
  }
}

async function processDirectory(dir, outDir, baseDir, manifest) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(dir, entry.name);
    const relativePath = relative(baseDir, srcPath);
    const destDir = join(outDir, dirname(relativePath));

    if (entry.isDirectory()) {
      await mkdir(join(outDir, relativePath), { recursive: true });
      await processDirectory(srcPath, outDir, baseDir, manifest);
      continue;
    }

    const ext = entry.name.split('.').pop();
    if (ext !== 'html' && ext !== 'js') continue;
    if (entry.name.endsWith('.loading.html')) continue;

    await mkdir(destDir, { recursive: true });
    const content = await readFile(srcPath, 'utf-8');

    let outputContent;
    let sourceMap;

    if (ext === 'html') {
      outputContent = await minifyHtml(content, HTML_MINIFY_OPTIONS);
    } else {
      const result = await minifyJs(content, {
        sourceMap: { filename: entry.name, url: 'inline' },
        compress: true,
        mangle: true
      });
      outputContent = result.code;
      sourceMap = result.map;
    }

    // Compute hash and create hashed filename
    const hash = contentHash(outputContent);
    const baseName = entry.name.replace(/\.[^.]+$/, '');
    const hashedName = `${baseName}.${hash}.${ext}`;
    const hashedPath = join(destDir, hashedName);

    // Record in manifest: relative original path -> relative hashed path
    const originalRelative = relativePath;
    const hashedRelative = join(dirname(relativePath), hashedName);
    manifest[originalRelative] = hashedRelative;

    await writeFile(hashedPath, outputContent);

    if (ext === 'js' && sourceMap) {
      await writeFile(`${hashedPath}.map`, sourceMap);
    }
  }
}

