#!/usr/bin/env node
/**
 * Verifies the theme system's core invariant: league colors are defined exactly
 * once, in src/styles/themes.css, and every picker page ships a server-rendered
 * data-theme attribute.
 *
 * Node built-ins only — this must not add a dependency.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const THEMES_CSS = 'src/styles/themes.css';

const THEMED_VARS = [
  '--title-color',
  '--nav-item-color',
  '--header-background-color',
  '--background-color',
];

const EXPECTED_KEYS = ['osrs/1', 'osrs/2', 'osrs/4', 'osrs/5', 'osrs/6', 'rs3/1', 'rs3/2'];

// Every picker page and the theme key its server-rendered HTML must carry.
const DIST_EXPECT = {
  'dist/osrs/1/index.html': 'osrs/1',
  'dist/osrs/2/index.html': 'osrs/2',
  'dist/osrs/4/index.html': 'osrs/4',
  'dist/osrs/5/index.html': 'osrs/5',
  'dist/osrs/5/masteries/index.html': 'osrs/5',
  'dist/osrs/6/index.html': 'osrs/6',
  'dist/osrs/6/pacts/index.html': 'osrs/6',
  'dist/rs3/1/index.html': 'rs3/1',
  'dist/rs3/2/index.html': 'rs3/2',
};

const failures = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Check 1: themes.css exists and defines every key with all four vars.
const themeColors = new Set();
if (!existsSync(THEMES_CSS)) {
  failures.push(`${THEMES_CSS} does not exist`);
} else {
  const css = readFileSync(THEMES_CSS, 'utf8');

  if (/:root\s*\[data-theme/.test(css)) {
    failures.push(
      `${THEMES_CSS}: selectors must not be prefixed with :root (breaks showcase per-row theming)`,
    );
  }
  if (css.includes('!important')) {
    failures.push(`${THEMES_CSS}: !important is not needed and must not be used`);
  }

  for (const key of EXPECTED_KEYS) {
    const block = css.match(new RegExp(`\\[data-theme="${key}"\\][^{]*\\{([^}]*)\\}`));
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

  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    themeColors.add(m[0].toLowerCase());
  }
}

// Check 2: no colour used by themes.css appears anywhere else under src/.
// This is the invariant that makes drift structurally impossible.
if (themeColors.size > 0) {
  const srcFiles = walk('src').filter((f) =>
    ['.astro', '.ts', '.css', '.json'].includes(extname(f)),
  );
  for (const file of srcFiles) {
    if (file === THEMES_CSS) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      if (themeColors.has(m[0].toLowerCase())) {
        failures.push(`${file}: theme colour ${m[0]} duplicated outside ${THEMES_CSS}`);
      }
    }
  }
}

// Check 3: built picker pages carry a server-rendered data-theme.
if (!existsSync('dist')) {
  console.log('note: dist/ not built — skipping server-rendered attribute checks');
} else {
  for (const [file, key] of Object.entries(DIST_EXPECT)) {
    if (!existsSync(file)) {
      failures.push(`${file} missing from build output`);
      continue;
    }
    if (!readFileSync(file, 'utf8').includes(`data-theme="${key}"`)) {
      failures.push(`${file}: expected data-theme="${key}" in server-rendered HTML`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} theme invariant failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ theme invariants hold');
