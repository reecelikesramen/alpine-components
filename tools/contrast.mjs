#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const defaultPalettePath = path.resolve(process.cwd(), 'tools', 'palette.json');

const usage = () => {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  node tools/contrast.mjs [--file path/to/palette.json] [--json]',
      '',
      'Palette format:',
      '  { themes: { light: { token: "oklch(L C H)" }, dark: {...} }, pairs: [{ name, fg, bg }] }'
    ].join('\n')
  );
};

const parseArgs = (argv) => {
  const args = { file: defaultPalettePath, json: false };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];

    if (a === '--help' || a === '-h') return { ...args, help: true };
    if (a === '--json') {
      args.json = true;
      continue;
    }

    if (a === '--file') {
      const next = argv[i + 1];
      if (!next) return { ...args, help: true };
      args.file = path.resolve(process.cwd(), next);
      i++;
      continue;
    }

    return { ...args, help: true };
  }

  return args;
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));

function parseOklch(input) {
  const s = String(input ?? '').trim();
  const m = s.match(/^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/i);
  if (!m) throw new Error(`Invalid OKLCH: "${s}" (expected oklch(L C H))`);
  const L = Number(m[1]);
  const C = Number(m[2]);
  const Hdeg = Number(m[3]);
  if (!Number.isFinite(L) || !Number.isFinite(C) || !Number.isFinite(Hdeg)) {
    throw new Error(`Invalid OKLCH numbers: "${s}"`);
  }
  return { L, C, Hdeg };
}

function oklchToLinearSrgb({ L, C, Hdeg }) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  // OKLab -> LMS (nonlinear)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS -> linear sRGB
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return { r, g, b: bb };
}

function relativeLuminanceFromLinear({ r, g, b }) {
  // Clamp out-of-gamut; for contrast-checking, this is “best effort”
  const rr = clamp01(r);
  const gg = clamp01(g);
  const bb = clamp01(b);
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
}

function contrastRatio(l1, l2) {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

function grade(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'FAIL';
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exitCode = 1;
    return;
  }

  const raw = await fs.readFile(args.file, 'utf8');
  const palette = JSON.parse(raw);

  const themes = palette.themes ?? {};
  const pairs = Array.isArray(palette.pairs) ? palette.pairs : [];

  const report = {};

  for (const [themeName, tokens] of Object.entries(themes)) {
    const tokenLums = {};
    for (const [tokenName, value] of Object.entries(tokens ?? {})) {
      const oklch = parseOklch(value);
      const lin = oklchToLinearSrgb(oklch);
      tokenLums[tokenName] = relativeLuminanceFromLinear(lin);
    }

    report[themeName] = pairs.map((p) => {
      const fgLum = tokenLums[p.fg];
      const bgLum = tokenLums[p.bg];
      if (!Number.isFinite(fgLum)) throw new Error(`Missing token "${p.fg}" in theme "${themeName}"`);
      if (!Number.isFinite(bgLum)) throw new Error(`Missing token "${p.bg}" in theme "${themeName}"`);

      const ratio = contrastRatio(fgLum, bgLum);
      return {
        name: p.name,
        fg: p.fg,
        bg: p.bg,
        ratio,
        grade: grade(ratio)
      };
    });
  }

  if (args.json) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ file: args.file, report }, null, 2));
    return;
  }

  // Pretty output
  // eslint-disable-next-line no-console
  console.log(`OKLCH contrast report (${path.relative(process.cwd(), args.file)})`);

  for (const [themeName, rows] of Object.entries(report)) {
    // eslint-disable-next-line no-console
    console.log(`\n[${themeName}]`);
    for (const r of rows) {
      const ratio = r.ratio.toFixed(2).padStart(5, ' ');
      // eslint-disable-next-line no-console
      console.log(`  ${ratio}  ${r.grade.padEnd(8, ' ')}  ${r.name}  (${r.fg} on ${r.bg})`);
    }
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e?.stack || String(e));
  process.exitCode = 1;
});


