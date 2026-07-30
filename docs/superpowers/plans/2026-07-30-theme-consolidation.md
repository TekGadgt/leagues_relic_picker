# Theme Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse league theme colors from seven definition sites into a single `src/styles/themes.css`, selected by a `data-theme` attribute, without reintroducing the pre-paint flicker the current duplication exists to avoid.

**Architecture:** Colors live in one stylesheet as element-level `[data-theme="{game}/{n}"]` blocks setting four CSS custom properties. Picker pages get `data-theme` server-rendered onto `<html>`; the homepage sets it from `localStorage` in a one-line pre-paint inline script; showcase rows each set their own so per-row theming resolves by custom-property inheritance. Every JS and JSON copy of the colors is deleted.

**Tech Stack:** Astro 5 (static output), TypeScript, plain CSS custom properties, html2canvas. No test framework in this repo — `npm run build` (`astro check && astro build`) is the type gate, and a new `scripts/verify-themes.mjs` (Node built-ins only, no new dependencies) is the invariant gate.

**Spec:** `docs/superpowers/specs/2026-07-30-theme-consolidation-design.md`

## Global Constraints

- The four themed vars are exactly: `--title-color`, `--nav-item-color`, `--header-background-color`, `--background-color`.
- The seven theme keys are exactly: `osrs/1`, `osrs/2`, `osrs/4`, `osrs/5`, `osrs/6`, `rs3/1`, `rs3/2`. Note there is no `osrs/3`.
- `rs3/1` is the default theme. It is expressed as the zero-specificity `:where(:root)` selector sharing a block with `[data-theme="rs3/1"]`.
- Selectors must NOT be prefixed with `:root` (e.g. write `[data-theme="osrs/1"]`, never `:root[data-theme="osrs/1"]`). The `:root` prefix would break showcase per-row theming.
- No `!important` on any themed var. `:where()` on the default guarantees an explicit theme always wins.
- Hex values are lowercase.
- Canonical color values (from the JSON `theme` blocks — these are what visitors currently see on a picker page):

| Key | `--title-color` | `--nav-item-color` | `--header-background-color` | `--background-color` |
|---|---|---|---|---|
| `osrs/1` | `#a3ce27` | `#6a8418` | `#0f1406` | `#060804` |
| `osrs/2` | `#f9ebb3` | `#96896b` | `#14120b` | `#080704` |
| `osrs/4` | `#cd7429` | `#7a451a` | `#160b05` | `#090402` |
| `osrs/5` | `#8ce0ff` | `#598fa3` | `#0b1933` | `#071022` |
| `osrs/6` | `#c33232` | `#7a0c0c` | `#140202` | `#0c0000` |
| `rs3/1` | `#d5281a` | `#9b1e14` | `#160403` | `#0c0000` |
| `rs3/2` | `#2fbf63` | `#1a8a4a` | `#07170f` | `#030b07` |

- Do not commit `.playwright-mcp/` artifacts if browser verification generates them.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `scripts/verify-themes.mjs` | Create | Asserts the invariant: colors defined once, `data-theme` server-rendered |
| `src/styles/themes.css` | Create | The single source of truth for league colors |
| `src/styles/global.css` | Modify | Import themes.css; drop color vars from `:root`; showcase row background |
| `src/layouts/BaseLayout.astro` | Modify | `themeKey` prop → `<html data-theme>`; one-line pre-paint script |
| `src/layouts/PickerLayout.astro` | Modify | Forward `themeKey`; delete injected `<style>` and `backgroundColor` |
| `src/pages/[...slug].astro` | Modify | Pass `themeKey` instead of `theme`/`backgroundColor` |
| `src/components/Footer.astro` | Modify | Dropdown from content collection; delete colors map |
| `src/pages/showcase.astro` | Modify | Emit `themeKey` instead of a `theme` object |
| `src/scripts/showcase.ts` | Modify | Per-row `data-theme` instead of inline styles |
| `src/scripts/picker.ts` | Modify | Export background from computed CSS var |
| `src/content/config.ts` | Modify | Drop `theme` and `backgroundColor` from schema |
| `src/content/leagues/*.json` (9) | Modify | Drop `theme` and `backgroundColor` keys |
| `public/{game}/{n}/variables.css` (7) | Delete | Dead code, unreferenced |
| `package.json` | Modify | Add `verify:themes` script |
| `CLAUDE.md` | Modify | Fix the two stale theming sections |

---

### Task 1: Theme invariant verification script

This task deliberately produces a **failing** check. It encodes the target state so every later task has something concrete to satisfy.

**Files:**
- Create: `scripts/verify-themes.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run verify:themes` — exits 0 when invariants hold, exits 1 and prints a `- ` prefixed failure list otherwise. Later tasks use it as their gate.

- [ ] **Step 1: Write the verification script**

Create `scripts/verify-themes.mjs`:

```js
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
```

- [ ] **Step 2: Register the npm script**

In `package.json`, add to `"scripts"` after `"astro"`:

```json
    "verify:themes": "node scripts/verify-themes.mjs"
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run verify:themes`
Expected: exit 1, with `- src/styles/themes.css does not exist` as the first failure. `dist/` may or may not exist; either is fine at this point.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-themes.mjs package.json
git commit -m "test: add theme invariant verification script"
```

---

### Task 2: Create themes.css and wire it into global.css

**Files:**
- Create: `src/styles/themes.css`
- Modify: `src/styles/global.css:1-9` (the `:root` block), `src/styles/global.css:725`

**Interfaces:**
- Consumes: nothing.
- Produces: seven `[data-theme="{game}/{n}"]` blocks plus a `:where(:root)` default, each setting the four themed vars. All later tasks depend on these selectors and on `--background-color` being resolvable from `document.documentElement`.

- [ ] **Step 1: Create the stylesheet**

Create `src/styles/themes.css`:

```css
/*
 * Single source of truth for league theme colours.
 *
 * Selected via a data-theme attribute: server-rendered onto <html> for picker
 * pages, set from localStorage by BaseLayout's pre-paint script on the homepage
 * and showcase, and set per row by showcase.ts so one page can show many
 * leagues at once.
 *
 * Selectors are element-level (no :root prefix) so any element can carry a
 * theme; custom properties then inherit to its descendants. The default is
 * wrapped in :where() to give it zero specificity, so an explicit data-theme
 * always wins regardless of source order — no !important required.
 */

:where(:root),
[data-theme="rs3/1"] {
  --title-color: #d5281a;
  --nav-item-color: #9b1e14;
  --header-background-color: #160403;
  --background-color: #0c0000;
}

[data-theme="osrs/1"] {
  --title-color: #a3ce27;
  --nav-item-color: #6a8418;
  --header-background-color: #0f1406;
  --background-color: #060804;
}

[data-theme="osrs/2"] {
  --title-color: #f9ebb3;
  --nav-item-color: #96896b;
  --header-background-color: #14120b;
  --background-color: #080704;
}

[data-theme="osrs/4"] {
  --title-color: #cd7429;
  --nav-item-color: #7a451a;
  --header-background-color: #160b05;
  --background-color: #090402;
}

[data-theme="osrs/5"] {
  --title-color: #8ce0ff;
  --nav-item-color: #598fa3;
  --header-background-color: #0b1933;
  --background-color: #071022;
}

[data-theme="osrs/6"] {
  --title-color: #c33232;
  --nav-item-color: #7a0c0c;
  --header-background-color: #140202;
  --background-color: #0c0000;
}

[data-theme="rs3/2"] {
  --title-color: #2fbf63;
  --nav-item-color: #1a8a4a;
  --header-background-color: #07170f;
  --background-color: #030b07;
}
```

- [ ] **Step 2: Import it from global.css and drop the duplicated colours**

Replace `src/styles/global.css` lines 1-9 (the current `:root` block) with:

```css
@import "./themes.css";

:root {
  --font-size-title: 5em;
  --font-size-subtitle: 3em;
  --font-size-nav-item: 2em;
}
```

The `@import` must be the first rule in the file — CSS requires `@import` to precede other rules.

- [ ] **Step 3: Make the showcase row background themeable**

In `src/styles/global.css`, in the `.showcase-row` rule (was line 725), replace:

```css
  background-color: rgba(255, 255, 255, 0.03);
```

with:

```css
  background-color: var(--background-color);
```

This takes over what `showcase.ts` currently sets inline per row. The sibling declarations in `.showcase-row` (`border-left: 4px solid var(--title-color)`), `.showcase-row-title` (`color: var(--title-color)`), and `.showcase-row-separator` (`color: var(--nav-item-color)`) already reference the themed vars and must NOT be changed.

- [ ] **Step 4: Run the invariant check**

Run: `npm run verify:themes`
Expected: still exit 1, but the `themes.css does not exist` failure is gone. Remaining failures are Check 2 duplicates — the theme colours still present in `BaseLayout.astro`, `Footer.astro`, the nine league JSON files, and `picker.ts`. Those are cleared by Tasks 3-7.

- [ ] **Step 5: Verify the build still passes**

Run: `npm run build`
Expected: exits 0. Picker pages still theme themselves through `PickerLayout`'s injected `<style>` at this point, so nothing is visually broken yet.

- [ ] **Step 6: Commit**

```bash
git add src/styles/themes.css src/styles/global.css
git commit -m "feat: add themes.css as single source of theme colours"
```

---

### Task 3: Server-render data-theme on picker pages

**Files:**
- Modify: `src/layouts/BaseLayout.astro:2-24` (props), `:27` (the `<html>` tag)
- Modify: `src/layouts/PickerLayout.astro:7-47`
- Modify: `src/pages/[...slug].astro:30-36`

**Interfaces:**
- Consumes: `themes.css` selectors from Task 2.
- Produces:
  - `BaseLayout` accepts `themeKey?: string` and renders `<html lang="en" data-theme={themeKey}>`. Omitted → Astro renders no attribute → the `:where(:root)` default applies.
  - `PickerLayout` accepts `themeKey: string` (required) and no longer accepts `theme`. It still accepts `backgroundColor` until Task 6.

- [ ] **Step 1: Add the themeKey prop to BaseLayout**

In `src/layouts/BaseLayout.astro`, add to the `Props` interface after `bodyClass?: string;`:

```ts
  themeKey?: string;
```

Add to the destructuring, after `bodyClass = "",`:

```ts
  themeKey,
```

Do not give `themeKey` a default — `undefined` is meaningful here, since it makes Astro omit the attribute entirely.

- [ ] **Step 2: Render the attribute**

Replace `<html lang="en">` with:

```astro
<html lang="en" data-theme={themeKey}>
```

- [ ] **Step 3: Strip the injected style from PickerLayout**

In `src/layouts/PickerLayout.astro`, replace the `Props` interface's `theme` member with `themeKey`. The interface becomes:

```ts
interface Props {
  meta: {
    title: string;
    description: string;
    ogImage: string;
    ogImageAlt: string;
    url: string;
  };
  themeKey: string;
  backgroundColor: string;
  exportFilename: string;
  pageType: 'relics' | 'masteries' | 'pacts';
}

const { meta, themeKey, backgroundColor, exportFilename, pageType } = Astro.props;
```

`backgroundColor` deliberately stays for now — `picker.ts` still reads it for image export, and Task 6 removes producer and consumer together. Removing it here would silently break exports for three commits.

Delete the entire `themeCSS` template literal (was lines 28-36) and the `<style set:html={themeCSS}></style>` line inside the `head` fragment. Leave the `define:vars={{ backgroundColor, exportFilename }}` script untouched.

Pass the key through to `BaseLayout` by adding this attribute to the `<BaseLayout ...>` opening tag:

```astro
  themeKey={themeKey}
```

- [ ] **Step 4: Pass themeKey from the route**

In `src/pages/[...slug].astro`, replace this line in the `<PickerLayout>` opening tag:

```astro
  theme={data.theme}
```

with:

```astro
  themeKey={`${data.game}/${data.leagueNumber}`}
```

Leave `backgroundColor={data.backgroundColor}` in place — Task 6 removes it.

- [ ] **Step 5: Build and check the server-rendered attribute**

Run: `npm run build && npm run verify:themes`

Expected: build exits 0. `verify:themes` still exits 1 on Check 2 duplicates, but **no** `dist/...: expected data-theme=` failures — Check 3 now passes for all nine pages. If any Check 3 failure appears, `themeKey` is not reaching `BaseLayout`.

Then confirm the theme rules are render-blocking rather than deferred — this is the flicker assumption the spec flagged for verification, not assumption:

Run: `grep -c 'data-theme="rs3/2"' dist/rs3/2/index.html`
Expected: `1` or more.

Run: `grep -o '<link[^>]*stylesheet[^>]*>' dist/rs3/2/index.html`
Expected: a plain `rel="stylesheet"` link in `<head>` with no `media="print"` and no `rel="preload"`. Alternatively Astro may inline the CSS as a `<style>` in `<head>` — either outcome is render-blocking and correct. If instead the stylesheet is emitted with `media="print"`, `onload`, or as a `preload`, stop and inline the theme rules via a `<style>` in `BaseLayout`'s head per the spec's fallback.

Also confirm the theme rules actually made it into the bundle:

Run: `grep -rl 'data-theme="osrs/1"' dist/_astro/*.css dist/*.html dist/**/*.html 2>/dev/null | head`
Expected: at least one match.

- [ ] **Step 6: Verify a picker page renders correctly with JavaScript disabled**

Start the dev server (`npm run dev`), then in the Playwright MCP browser open `http://localhost:4321/rs3/2/` and evaluate:

```js
() => getComputedStyle(document.documentElement).getPropertyValue('--title-color').trim()
```

Expected: `#2fbf63`. Repeat for `http://localhost:4321/osrs/1/`, expecting `#a3ce27`. This proves the CSS-only path works — no JS runs to theme these pages now.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro src/layouts/PickerLayout.astro src/pages/'[...slug]'.astro
git commit -m "feat: server-render data-theme on picker pages"
```

---

### Task 4: Homepage pre-paint script and collection-driven dropdown

**Files:**
- Modify: `src/layouts/BaseLayout.astro:31-52` (the `enableThemeScript` block)
- Modify: `src/components/Footer.astro:1-8` (frontmatter), `:34-46` (the select), `:51-85` (the script)

**Interfaces:**
- Consumes: `themes.css` selectors (Task 2); `BaseLayout`'s `themeKey` prop (Task 3).
- Produces: `localStorage.selectedTheme` holds a theme key string (e.g. `"rs3/2"`), unchanged in format from today, so existing users' saved themes keep working.

- [ ] **Step 1: Collapse the pre-paint script**

In `src/layouts/BaseLayout.astro`, replace the entire `{enableThemeScript && (...)}` block (the `<script is:inline>` containing the `themes` object) with:

```astro
    {enableThemeScript && (
      <script is:inline>
        // Apply the saved theme before first paint to prevent flicker.
        // An unknown key matches no themes.css block and falls through to the
        // :where(:root) default, so no key whitelist is needed here.
        document.documentElement.dataset.theme =
          localStorage.getItem('selectedTheme') || 'rs3/1';
      </script>
    )}
```

- [ ] **Step 2: Build the dropdown from the content collection**

In `src/components/Footer.astro`, replace the frontmatter (lines 1-8) with:

```astro
---
import { getCollection } from 'astro:content';

// Footer component with social links and theme selector
interface Props {
  showThemeSelector?: boolean;
}

const { showThemeSelector = false } = Astro.props;

// One dropdown entry per league, derived from the content collection so a new
// league can never show a stale hardcoded label. Several leagues have more than
// one page (relics + masteries/pacts) but share a single theme, hence the dedupe.
const leagues = await getCollection('leagues');
const seen = new Set<string>();
const themeOptions = leagues
  .map((league) => ({
    key: `${league.data.game}/${league.data.leagueNumber}`,
    game: league.data.game,
    leagueNumber: league.data.leagueNumber,
    label: league.data.name.replace(/ League$/, ''),
  }))
  .filter((option) => (seen.has(option.key) ? false : seen.add(option.key)))
  .sort((a, b) => a.game.localeCompare(b.game) || a.leagueNumber - b.leagueNumber);

const osrsOptions = themeOptions.filter((option) => option.game === 'osrs');
const rs3Options = themeOptions.filter((option) => option.game === 'rs3');
---
```

`'osrs'.localeCompare('rs3')` is negative, so OSRS sorts before RS3, matching the current group order.

- [ ] **Step 3: Render the generated options**

Replace the `<select id="theme-select">...</select>` element and both hardcoded `<optgroup>`s with:

```astro
      <select id="theme-select">
        <optgroup label="OSRS">
          {osrsOptions.map((option) => (
            <option value={option.key}>{option.label}</option>
          ))}
        </optgroup>
        <optgroup label="RS3">
          {rs3Options.map((option) => (
            <option value={option.key}>{option.label}</option>
          ))}
        </optgroup>
      </select>
```

- [ ] **Step 4: Replace the script with attribute switching**

Replace the whole `{showThemeSelector && (<script>...</script>)}` block at the bottom of the file with:

```astro
{showThemeSelector && (
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
      if (!themeSelect) return;

      // Fall back to the default if the saved key is no longer offered, so the
      // select never renders blank.
      const saved = localStorage.getItem('selectedTheme');
      const isKnown = Array.from(themeSelect.options).some((option) => option.value === saved);
      const initial = isKnown && saved ? saved : 'rs3/1';

      themeSelect.value = initial;
      document.documentElement.dataset.theme = initial;

      themeSelect.addEventListener('change', function () {
        localStorage.setItem('selectedTheme', this.value);
        document.documentElement.dataset.theme = this.value;
      });
    });
  </script>
)}
```

- [ ] **Step 5: Build and verify the dropdown is unchanged**

Run: `npm run build`
Expected: exits 0.

Run: `grep -o '<option value="[^"]*">[^<]*</option>' dist/index.html`
Expected exactly these seven, in this order — this is the character-for-character check that the derived labels match the old hardcoded ones:

```
<option value="osrs/1">Twisted</option>
<option value="osrs/2">Trailblazer</option>
<option value="osrs/4">Trailblazer Reloaded</option>
<option value="osrs/5">Raging Echoes</option>
<option value="osrs/6">Demonic Pacts</option>
<option value="rs3/1">Catalyst</option>
<option value="rs3/2">Equilibrium</option>
```

- [ ] **Step 6: Verify theme switching and persistence in the browser**

With `npm run dev` running, open `http://localhost:4321/` in the Playwright MCP browser. For each of the seven keys, select it and read back the computed variable:

```js
() => {
  const select = document.getElementById('theme-select');
  select.value = 'osrs/1';
  select.dispatchEvent(new Event('change'));
  return {
    attr: document.documentElement.dataset.theme,
    title: getComputedStyle(document.documentElement).getPropertyValue('--title-color').trim(),
    saved: localStorage.getItem('selectedTheme'),
  };
}
```

Expected for `osrs/1`: `{ attr: 'osrs/1', title: '#a3ce27', saved: 'osrs/1' }`. Repeat for the other six against the Global Constraints table. Then reload the page and confirm `--title-color` still matches the last selection, proving the pre-paint script reads `localStorage` correctly.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/Footer.astro
git commit -m "feat: drive homepage theming from data-theme attribute"
```

---

### Task 5: Per-row showcase theming

**Files:**
- Modify: `src/pages/showcase.astro:10-46`
- Modify: `src/scripts/showcase.ts:170-195` and the `BuildData` type declaration

**Interfaces:**
- Consumes: element-level `[data-theme]` selectors from Task 2; `.showcase-row` background from Task 2 Step 3.
- Produces: `BuildData.themeKey: string` replaces `BuildData.theme`. The per-league payload object emitted by `showcase.astro` exposes `themeKey: string` instead of a `theme` object.

- [ ] **Step 1: Emit a themeKey from the page**

In `src/pages/showcase.astro`, in the `LeagueEntry` type, replace the whole `theme` member:

```ts
  theme: {
    titleColor: string;
    navItemColor: string;
    headerBackgroundColor: string;
    backgroundColor: string;
  };
```

with:

```ts
  themeKey: string;
```

Then in the `leagueData[key] = {...}` object literal, replace `theme: league.data.theme,` with:

```ts
    themeKey: `${league.data.game}/${league.data.leagueNumber}`,
```

- [ ] **Step 2: Find and update the BuildData type**

Run: `grep -n "theme" src/scripts/showcase.ts`

In the `BuildData` type (and any other local type carrying it), replace the `theme` member with `themeKey: string;`. Follow whatever shape the file already declares — if `theme` is typed inline as an object of four colour strings, the replacement is the single line `themeKey: string;`.

- [ ] **Step 3: Replace the inline styles with one attribute**

In `renderBuildRow` in `src/scripts/showcase.ts`, delete these four lines:

```ts
  row.style.borderLeftColor = build.theme.titleColor;
  row.style.backgroundColor = build.theme.backgroundColor;
```

```ts
  titleSpan.style.color = build.theme.titleColor;
```

```ts
  separator.style.color = build.theme.titleColor;
```

and in their place, immediately after the `// Apply theme colors to row` comment, add:

```ts
  // The row carries its own theme; global.css reads the inherited custom
  // properties, so each row can show a different league on one page.
  row.dataset.theme = build.themeKey;
```

Leave the early `if (build.error)` return above untouched — error rows deliberately inherit the page theme, exactly as they do today.

Note this intentionally changes separator colour from the league's title colour to its nav-item colour, honouring what `.showcase-row-separator` CSS already asks for. This is recorded as intentional visual change #5 in the spec.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exits 0. If `astro check` reports a remaining reference to `build.theme` or `league.data.theme`, fix that reference — the type change is doing its job by surfacing it.

- [ ] **Step 5: Verify rows are independently themed**

With `npm run dev` running, open `http://localhost:4321/showcase/` in the Playwright MCP browser. Paste these two share URLs (one per line) into the input and submit:

```
http://localhost:4321/osrs/1/?selected=tier1-1&title=Twisted+Build
http://localhost:4321/rs3/2/?selected=tier1-1&title=Equilibrium+Build
```

Then evaluate:

```js
() => [...document.querySelectorAll('.showcase-row')].map((row) => ({
  theme: row.dataset.theme,
  title: getComputedStyle(row).getPropertyValue('--title-color').trim(),
  border: getComputedStyle(row).borderLeftColor,
}))
```

Expected: two entries with different `theme` values (`osrs/1` and `rs3/2`), `--title-color` of `#a3ce27` and `#2fbf63` respectively, and correspondingly different `borderLeftColor` values. Two rows resolving to the same colour means the per-row attribute is not being applied.

- [ ] **Step 6: Commit**

```bash
git add src/pages/showcase.astro src/scripts/showcase.ts
git commit -m "feat: theme showcase rows via data-theme instead of inline styles"
```

---

### Task 6: Read export background from the cascade

**Files:**
- Modify: `src/scripts/picker.ts:1-10` (the `PickerConfig` type), `:241-244`, `:377`, `:397`
- Modify: `src/layouts/PickerLayout.astro` (`Props`, destructuring, `define:vars`)
- Modify: `src/pages/[...slug].astro` (drop `backgroundColor`)

**Interfaces:**
- Consumes: `--background-color` resolvable on `document.documentElement` (Task 2).
- Produces: `getExportBackgroundColor(): string` — the current themed background as a computed CSS colour string, for html2canvas. `PICKER_CONFIG` is reduced to `{ exportFilename }`, and `backgroundColor` stops flowing through `PickerLayout` entirely.

This task removes the `backgroundColor` producer and consumer in a single commit, so image export is never broken in between.

- [ ] **Step 1: Drop backgroundColor from the config type**

In `src/scripts/picker.ts`, remove the `backgroundColor: string;` member from the `PickerConfig` interface (around line 5), leaving `exportFilename: string;`.

- [ ] **Step 2: Add the helper and fix the fallback**

Replace `getPickerConfig` (lines 241-244) with:

```ts
// Get picker config from global variable
function getPickerConfig(): PickerConfig {
  const w = window as Window & { PICKER_CONFIG?: PickerConfig };
  return w.PICKER_CONFIG || { exportFilename: 'export.png' };
}

// The export background comes from the active theme rather than page config, so
// themes.css stays the only place a league colour is written down.
function getExportBackgroundColor(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--background-color')
    .trim();
}
```

- [ ] **Step 3: Use the helper at both export sites**

Replace line 377:

```ts
      mainElement.style.backgroundColor = config.backgroundColor;
```

with:

```ts
      const exportBackgroundColor = getExportBackgroundColor();
      mainElement.style.backgroundColor = exportBackgroundColor;
```

and replace line 397:

```ts
            backgroundColor: config.backgroundColor
```

with:

```ts
            backgroundColor: exportBackgroundColor
```

`exportBackgroundColor` is declared in the enclosing function scope before the `requestAnimationFrame` callback, so the closure captures it. Leave the `mainElement.style.backgroundColor = '';` reset in `restoreLayout` unchanged.

- [ ] **Step 4: Stop threading backgroundColor through the layout**

Now that nothing reads it, remove the producer in the same commit.

In `src/layouts/PickerLayout.astro`, delete `backgroundColor: string;` from the `Props` interface and `backgroundColor,` from the destructuring, then narrow the config script to:

```astro
  <script is:inline define:vars={{ exportFilename }}>
    window.PICKER_CONFIG = {
      exportFilename,
    };
  </script>
```

In `src/pages/[...slug].astro`, delete this line from the `<PickerLayout>` opening tag:

```astro
  backgroundColor={data.backgroundColor}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: exits 0. `astro check` will flag any remaining `config.backgroundColor` reference.

- [ ] **Step 6: Verify an exported image keeps the right background**

With `npm run dev` running, open `http://localhost:4321/osrs/1/` in the Playwright MCP browser, select a relic, click **Export Image**, and save the download. Then check the corner pixel:

```bash
magick /path/to/downloaded.png -crop 1x1+2+2 -format '%[hex:p{0,0}]' info:
```

Expected: `060804` — osrs/1's background from the Global Constraints table. Anything else (notably `071022`, the removed hardcoded fallback) means the computed variable is not being read.

- [ ] **Step 7: Commit**

```bash
git add src/scripts/picker.ts src/layouts/PickerLayout.astro src/pages/'[...slug]'.astro
git commit -m "refactor: read export background from active theme"
```

---

### Task 7: Remove colours from the schema and league data

This is the task that makes the invariant hold — until now the JSON still carried every colour.

**Files:**
- Modify: `src/content/config.ts:38-58` (`leagueBaseSchema`)
- Modify: all nine files in `src/content/leagues/`

**Interfaces:**
- Consumes: nothing new; every consumer of `data.theme` and `data.backgroundColor` was removed in Tasks 3, 5, and 6.
- Produces: league JSON with no colour data. `game`, `leagueNumber`, and `name` remain and are still required by `Footer` (Task 4) and `showcase.astro` (Task 5).

- [ ] **Step 1: Drop the schema members**

In `src/content/config.ts`, in `leagueBaseSchema`, delete the `backgroundColor: z.string(),` line and the entire `theme: z.object({...}),` block. The schema keeps `game`, `leagueNumber`, `name`, `pageType`, `exportFilename`, and `meta`.

- [ ] **Step 2: Strip both keys from all nine JSON files**

Run this from the repo root — it removes the keys while preserving each file's 2-space formatting and trailing newline:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const dir = "src/content/leagues";
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json")) continue;
  const path = `${dir}/${file}`;
  const data = JSON.parse(readFileSync(path, "utf8"));
  delete data.theme;
  delete data.backgroundColor;
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`stripped ${file}`);
}
'
```

- [ ] **Step 3: Confirm the keys are gone**

Run: `grep -l '"theme"\|"backgroundColor"' src/content/leagues/*.json`
Expected: no output.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exits 0. `astro check` validates every JSON against the narrowed schema, so an unexpected failure here means a colour consumer was missed in an earlier task.

- [ ] **Step 5: The invariant should now hold**

Run: `npm run verify:themes`
Expected: **exit 0**, printing `✓ theme invariants hold`.

If Check 2 still reports duplicates, read each one. A genuine leftover copy must be removed. A coincidental collision — some unrelated rule in `global.css` happening to use a colour that is also a theme colour — should be resolved by changing that unrelated declaration to `var(--…)` if it is semantically the theme colour, or by nudging it to a distinct hex if it is not. Do not weaken the check to make it pass.

- [ ] **Step 6: Commit**

```bash
git add src/content/config.ts src/content/leagues
git commit -m "refactor: remove theme colours from league content schema"
```

---

### Task 8: Delete dead variables.css and correct CLAUDE.md

**Files:**
- Delete: `public/osrs/{1,2,4,5,6}/variables.css`, `public/rs3/{1,2}/variables.css`
- Modify: `CLAUDE.md` — the project-structure tree, "Adding a New League" step 3, and the "Theme System" section

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm the files really are unreferenced**

Run: `grep -rn "variables.css" src/ public/ astro.config.mjs netlify.toml`
Expected: no output. If anything matches, stop and investigate rather than deleting.

- [ ] **Step 2: Delete them**

```bash
git rm public/osrs/1/variables.css public/osrs/2/variables.css \
       public/osrs/4/variables.css public/osrs/5/variables.css \
       public/osrs/6/variables.css public/rs3/1/variables.css \
       public/rs3/2/variables.css
```

- [ ] **Step 3: Fix the stale documentation**

In `CLAUDE.md`:

Replace the "Theme System" section body with:

```markdown
League colors live in one place: `src/styles/themes.css`, as element-level
`[data-theme="{game}/{number}"]` blocks setting `--title-color`,
`--nav-item-color`, `--header-background-color`, and `--background-color`.

Picker pages get `data-theme` server-rendered onto `<html>` by `BaseLayout`, so
they need no JavaScript to theme themselves. The homepage and showcase set it
from `localStorage.selectedTheme` in a pre-paint inline script in `BaseLayout`,
which is what keeps theme switching flicker-free. Showcase rows each set their
own `data-theme`, so one page can display several leagues at once.

The default theme is `rs3/1`, expressed as the zero-specificity
`:where(:root)` selector sharing its block. Run `npm run verify:themes` to
assert no color is duplicated outside `themes.css`.
```

Replace "Adding a New League" step 3 with:

```markdown
3. Add a `[data-theme="{game}/{number}"]` block to `src/styles/themes.css`
```

In the project-structure tree, remove the `variables.css` mention from the
`public/` listing and add `themes.css` alongside `global.css` under
`src/styles/`.

- [ ] **Step 4: Verify nothing broke**

Run: `npm run build && npm run verify:themes`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A public CLAUDE.md
git commit -m "chore: delete dead variables.css and correct theming docs"
```

---

### Task 9: Full verification pass

No code changes. This task exists because the spec lists seven verification criteria and the earlier tasks each only checked their own slice.

**Files:** none modified.

**Interfaces:**
- Consumes: the completed implementation.
- Produces: a pass/fail report against the spec's verification section.

- [ ] **Step 1: Gates**

Run: `npm run build && npm run verify:themes`
Expected: both exit 0.

- [ ] **Step 2: Confirm every picker page computes its intended colours**

With `npm run dev` running, visit each of the nine URLs in the Playwright MCP browser and evaluate:

```js
() => {
  const s = getComputedStyle(document.documentElement);
  return {
    theme: document.documentElement.dataset.theme,
    title: s.getPropertyValue('--title-color').trim(),
    nav: s.getPropertyValue('--nav-item-color').trim(),
    header: s.getPropertyValue('--header-background-color').trim(),
    bg: s.getPropertyValue('--background-color').trim(),
  };
}
```

| URL | Expected `theme` | Expected `title` / `nav` / `header` / `bg` |
|---|---|---|
| `/osrs/1/` | `osrs/1` | `#a3ce27` `#6a8418` `#0f1406` `#060804` |
| `/osrs/2/` | `osrs/2` | `#f9ebb3` `#96896b` `#14120b` `#080704` |
| `/osrs/4/` | `osrs/4` | `#cd7429` `#7a451a` `#160b05` `#090402` |
| `/osrs/5/` | `osrs/5` | `#8ce0ff` `#598fa3` `#0b1933` `#071022` |
| `/osrs/5/masteries/` | `osrs/5` | `#8ce0ff` `#598fa3` `#0b1933` `#071022` |
| `/osrs/6/` | `osrs/6` | `#c33232` `#7a0c0c` `#140202` `#0c0000` |
| `/osrs/6/pacts/` | `osrs/6` | `#c33232` `#7a0c0c` `#140202` `#0c0000` |
| `/rs3/1/` | `rs3/1` | `#d5281a` `#9b1e14` `#160403` `#0c0000` |
| `/rs3/2/` | `rs3/2` | `#2fbf63` `#1a8a4a` `#07170f` `#030b07` |

- [ ] **Step 3: Screenshot the four intentional visual changes**

Capture and eyeball each, confirming it matches the spec's "Intentional visual changes" list:

1. Homepage with **Catalyst** selected — nav items `#9b1e14` (was `#802010`), background `#0c0000` (was `#080201`).
2. Homepage with **Demonic Pacts** selected — nav items `#7a0c0c` (was `#cc0000`).
3. `/osrs/6/` — background `#0c0000`, now matching `/osrs/6/pacts/` rather than the old `#070101`.
4. `/showcase/` with two rows loaded — separators now nav-item coloured rather than title coloured.

- [ ] **Step 4: Confirm no flicker on the homepage**

Set a non-default theme (e.g. `osrs/5`, whose cyan is unmistakable against the `rs3/1` red default), then hard-reload and screenshot immediately. The first painted frame must already be cyan-on-dark-blue. Any red flash means the pre-paint script is not running before paint — investigate whether the theme stylesheet became non-blocking.

Also verify the reverse case is clean: clear `localStorage`, reload, and confirm the page paints `rs3/1` red with no intermediate cyan (which was the old `global.css` osrs/5 default leaking through).

- [ ] **Step 5: Report**

Summarise each of the spec's seven verification criteria as pass or fail, with the observed value for anything that failed. Do not mark the plan complete with a failing criterion — report it instead.

- [ ] **Step 6: Clean up any browser artifacts**

Run: `rm -rf .playwright-mcp && git status --short`
Expected: a clean tree (all work already committed).

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: `themes.css` and the selector strategy → Task 2; `global.css` → Task 2; `BaseLayout` → Tasks 3 and 4; `PickerLayout` → Task 3; `[...slug].astro` → Task 3; `Footer` → Task 4; `showcase.astro` and `showcase.ts` → Task 5; `picker.ts` → Task 6; `config.ts` and league JSON → Task 7; deletions and docs → Task 8. The spec's seven verification criteria are covered by Task 1's script (criteria 1-2), Task 3 Step 6 and Task 9 Step 2 (criterion 3 and 6), Task 4 Step 6 (criterion 4), Task 5 Step 5 (criterion 5), and Task 6 Step 5 (criterion 7). The flicker assumption the spec flagged for empirical checking is Task 3 Step 5 and Task 9 Step 4.

**Placeholder scan.** No TBD/TODO markers, and no step defers work with "add error handling" or "write tests for the above". Every code step carries the literal content to write. Task 5 Step 2 is the one step that says to inspect the file before editing rather than quoting an exact before-image — that is deliberate, because `BuildData`'s `theme` member shape was not read during planning; the step states the exact replacement (`themeKey: string;`) regardless of what it replaces.

**Type consistency.** `themeKey` is the name used consistently for the prop on `BaseLayout` (optional) and `PickerLayout` (required), the field on `showcase.astro`'s payload, and the field on `BuildData`. `getExportBackgroundColor()` is defined in Task 6 Step 2 and used in Step 3 under that exact name. Colour values in the Global Constraints table, `themes.css` (Task 2), and the Task 9 verification table were cross-checked and agree.

**Every commit stays functional.** An earlier draft had Task 3 narrow `PICKER_CONFIG` to `{ exportFilename }` while `picker.ts` still read `config.backgroundColor` until Task 6, which would have left image exports silently using an `undefined` background for three commits. `backgroundColor` now flows untouched through Tasks 3-5 and Task 6 removes producer and consumer together. The same reasoning explains why Task 6 can come after Task 3 at all: `PickerLayout`'s injected `<style>` is gone by then, but `themes.css` sets `--background-color` on `<html>` via the server-rendered `data-theme`, so `getComputedStyle` resolves it either way.
