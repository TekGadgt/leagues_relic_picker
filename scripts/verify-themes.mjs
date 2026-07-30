#!/usr/bin/env node
/**
 * Verifies the theme system's core invariant: league colors are defined exactly
 * once, in src/styles/themes.css, and every picker page ships a server-rendered
 * data-theme attribute whose CSS actually reaches the browser render-blocking.
 *
 * Node built-ins only — this must not add a dependency.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const THEMES_CSS = 'src/styles/themes.css';
const LEAGUES_DIR = 'src/content/leagues';

const THEMED_VARS = [
  '--title-color',
  '--nav-item-color',
  '--header-background-color',
  '--background-color',
];

// Derive the league roster from the content collection itself, rather than
// hardcoding it here, so a new league JSON file automatically extends every
// check below — the whole point of this script is that the roster lives in
// exactly one place (the content collection), not two.
const leagueFiles = readdirSync(LEAGUES_DIR).filter((f) => f.endsWith('.json'));
const leagues = leagueFiles.map((f) => JSON.parse(readFileSync(join(LEAGUES_DIR, f), 'utf8')));

const EXPECTED_KEYS = [...new Set(leagues.map((l) => `${l.game}/${l.leagueNumber}`))].sort();

// Every picker page and the theme key its server-rendered HTML must carry.
// relics pages are /{game}/{n}/; every other pageType is /{game}/{n}/{pageType}/.
const DIST_EXPECT = {};
for (const l of leagues) {
  const key = `${l.game}/${l.leagueNumber}`;
  const distPath =
    l.pageType === 'relics'
      ? `dist/${l.game}/${l.leagueNumber}/index.html`
      : `dist/${l.game}/${l.leagueNumber}/${l.pageType}/index.html`;
  DIST_EXPECT[distPath] = key;
}

const failures = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Strip CSS comments before any textual check below. Without this, a comment
// explaining *why* !important isn't needed (which necessarily contains the
// string "!important") trips the very check it's documenting.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Check 1: themes.css exists and defines every key with all four vars.
const themeColors = new Set();
if (!existsSync(THEMES_CSS)) {
  failures.push(`${THEMES_CSS} does not exist`);
} else {
  const css = readFileSync(THEMES_CSS, 'utf8');
  const cssNoComments = stripComments(css);

  // Catches element-qualified attribute selectors like `:root[data-theme` or
  // `html[data-theme` (both break showcase per-row theming by out-specificity-ing
  // a row's own [data-theme] attribute), without flagging the descendant-combinator
  // form `:root [data-theme]` (a space before the bracket), which doesn't have
  // that problem.
  if (/(:root|html)\[data-theme/i.test(cssNoComments)) {
    failures.push(
      `${THEMES_CSS}: selectors must not be element-qualified (e.g. :root[data-theme] or html[data-theme]) — breaks showcase per-row theming`,
    );
  }
  if (cssNoComments.includes('!important')) {
    failures.push(`${THEMES_CSS}: !important is not needed and must not be used`);
  }
  if (!/:where\(\s*:root\s*\)/.test(cssNoComments)) {
    failures.push(
      `${THEMES_CSS}: missing a zero-specificity :where(:root) default block`,
    );
  }

  for (const key of EXPECTED_KEYS) {
    const block = cssNoComments.match(new RegExp(`\\[data-theme="${key}"\\][^{]*\\{([^}]*)\\}`));
    if (!block) {
      failures.push(`${THEMES_CSS}: missing block for [data-theme="${key}"]`);
      continue;
    }
    for (const v of THEMED_VARS) {
      if (!new RegExp(`${v}\\s*:`).test(block[1])) {
        failures.push(`${THEMES_CSS}: [data-theme="${key}"] does not set ${v}`);
      }
    }
  }

  for (const m of cssNoComments.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    themeColors.add(m[0].toLowerCase());
  }
}

// Check 2: no colour used by themes.css appears anywhere else under src/ or
// public/. This is the invariant that makes drift structurally impossible —
// public/ is included because the seven dead variables.css files this branch
// deleted lived there, and nothing else would catch one being recreated.
if (themeColors.size > 0) {
  const candidateFiles = [
    ...walk('src'),
    ...(existsSync('public') ? walk('public') : []),
  ].filter((f) => ['.astro', '.ts', '.css', '.json'].includes(extname(f)));

  for (const file of candidateFiles) {
    if (file === THEMES_CSS) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      if (themeColors.has(m[0].toLowerCase())) {
        failures.push(`${file}: theme colour ${m[0]} duplicated outside ${THEMES_CSS}`);
      }
    }
  }
}

// Resolve the CSS a built page's <head> actually causes the browser to load,
// render-blocking, combining inline <style> content with the contents of any
// linked stylesheet resolved against dist/. Returns { css, errors }.
function resolveHeadCss(html, htmlFile) {
  let css = '';
  const errors = [];

  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) {
    errors.push(`${htmlFile}: no <head> element found`);
    return { css, errors };
  }
  const head = headMatch[1];

  // Inline <style> blocks are render-blocking by definition.
  for (const m of head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    css += m[1] + '\n';
  }

  for (const m of head.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = m[1];
    const relMatch = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const rel = relMatch ? relMatch[1].toLowerCase().trim() : '';
    const asMatch = attrs.match(/\bas\s*=\s*["']([^"']+)["']/i);
    const isPreloadStyle = rel === 'preload' && asMatch && asMatch[1].toLowerCase() === 'style';

    // Only <link> tags that are (or claim to be) delivering a stylesheet matter here.
    if (rel !== 'stylesheet' && !isPreloadStyle) continue;

    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';

    // Only the site's own bundled assets are in scope — an external stylesheet
    // (web fonts, a CDN, etc.) is not part of the themed CSS chain and its
    // loading strategy is somebody else's concern, not this gate's.
    if (!href.startsWith('/') || href.startsWith('//')) continue;

    if (isPreloadStyle) {
      errors.push(
        `${htmlFile}: stylesheet ${href} is loaded via rel="preload" (async-loading pattern), not render-blocking`,
      );
      continue;
    }
    const mediaMatch = attrs.match(/\bmedia\s*=\s*["']([^"']+)["']/i);
    if (mediaMatch && mediaMatch[1].toLowerCase().trim() === 'print') {
      errors.push(`${htmlFile}: stylesheet ${href} is loaded with media="print", not render-blocking`);
      continue;
    }
    if (/\bonload\s*=/i.test(attrs)) {
      errors.push(
        `${htmlFile}: stylesheet ${href} carries an onload= attribute (async-loading pattern), not render-blocking`,
      );
      continue;
    }

    // A cache-busting query or fragment is part of the URL, not the filename.
    // Astro's content-hashed output carries neither today, but this gate blocks
    // deploys, so it must not fail on a legitimate href shape.
    const cssPath = join('dist', href.replace(/[?#].*$/, '').slice(1));
    if (!existsSync(cssPath)) {
      errors.push(`${htmlFile}: referenced stylesheet ${cssPath} is missing from the build output`);
      continue;
    }
    css += readFileSync(cssPath, 'utf8') + '\n';
  }

  return { css, errors };
}

// Check 3: built picker pages carry a server-rendered data-theme, AND the CSS
// that page's <head> actually causes the browser to load — resolved the same
// way a browser would, not just grepped from source — contains every themed
// block. This is what catches, e.g., a deleted `@import "./themes.css";` in
// global.css: source-level Check 1 still passes, but no browser would ever
// see a themed rule.
if (!existsSync('dist')) {
  console.log('note: dist/ not built — skipping server-rendered attribute checks');
} else {
  for (const [file, key] of Object.entries(DIST_EXPECT)) {
    if (!existsSync(file)) {
      failures.push(`${file} missing from build output`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    if (!html.includes(`data-theme="${key}"`)) {
      failures.push(`${file}: expected data-theme="${key}" in server-rendered HTML`);
    }

    const { css, errors } = resolveHeadCss(html, file);
    failures.push(...errors);

    if (css.trim() === '') {
      failures.push(`${file}: no stylesheet (linked or inline) found in <head>`);
    } else {
      for (const k of EXPECTED_KEYS) {
        if (!css.includes(`[data-theme="${k}"]`)) {
          failures.push(
            `${file}: CSS actually loaded by this page is missing [data-theme="${k}"] — themes.css may not be reaching the browser`,
          );
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} theme invariant failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ theme invariants hold');
