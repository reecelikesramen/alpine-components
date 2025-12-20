import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
const docsRoot = path.join(repoRoot, 'docs');
// Generate directly into `dist/` so it's not committed (dist/ is gitignored).
// Also write to `public/` for dev mode (public/search/ is gitignored).
const distFile = path.join(docsRoot, 'dist', 'search', 'index.json');
const publicFile = path.join(docsRoot, 'public', 'search', 'index.json');

const pages = [
  { slug: 'guide', file: 'guide.html' },
  { slug: 'loading-strategies', file: 'loading-strategies.html' },
  { slug: 'slots', file: 'slots.html' },
  { slug: 'loading-states', file: 'loading-states.html' },
  { slug: 'vite-plugin', file: 'vite-plugin.html' },
  { slug: 'api', file: 'api.html' }
];

const decodeEntities = (s) =>
  s
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");

const stripTags = (s) =>
  decodeEntities(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slugify = (s) =>
  stripTags(s)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

function extractPageTitle(html) {
  const m = html.match(/pageTitle="([^"]+)"/);
  if (!m) return null;
  return stripTags(m[1]);
}

function extractHeadings(html) {
  // Very small/robust parser: split into segments by heading tags.
  const re = /<(h[1-3])>([\s\S]*?)<\/\1>/gi;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    matches.push({
      tag: m[1].toLowerCase(),
      raw: m[2],
      index: m.index
    });
  }

  return matches.map((h, i) => {
    const start = h.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const segment = html.slice(start, end);

    const title = stripTags(h.raw);
    const id = slugify(title);

    // Grab some surrounding text as a snippet
    const snippet = stripTags(segment).slice(0, 220);

    return {
      level: Number(h.tag.slice(1)),
      title,
      id,
      snippet
    };
  });
}

async function main() {
  const items = [];
  const pageMeta = [];

  for (const page of pages) {
    const full = path.join(docsRoot, page.file);
    const html = await fs.readFile(full, 'utf8');

    const pageTitle = extractPageTitle(html) ?? page.slug;
    pageMeta.push({ slug: page.slug, title: pageTitle, url: page.slug });

    for (const h of extractHeadings(html)) {
      // Skip repeated H1 on some pages? Keep it; it's helpful for search.
      items.push({
        page: page.slug,
        pageTitle,
        title: h.title,
        level: h.level,
        url: `${page.slug}#${h.id}`,
        content: h.snippet
      });
    }
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    pages: pageMeta,
    items
  };

  // Write to dist/ for production builds
  await fs.mkdir(path.dirname(distFile), { recursive: true });
  await fs.writeFile(distFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  
  // Also write to public/ for dev mode (Vite serves from public/)
  await fs.mkdir(path.dirname(publicFile), { recursive: true });
  await fs.writeFile(publicFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  
  // eslint-disable-next-line no-console
  console.log(`Wrote ${items.length} search entries to ${path.relative(repoRoot, distFile)}`);
}

await main();


