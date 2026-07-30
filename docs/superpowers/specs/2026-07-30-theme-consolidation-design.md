# Theme Consolidation Design

**Date:** 2026-07-30
**Branch:** `theme-consolidation`
**Status:** Approved

## Problem

League theme colors are defined in seven places, and they have already drifted. Five are structural:

| Location | Role | Live? |
|---|---|---|
| `src/content/leagues/*.json` → `theme` block | picker page colors, via `PickerLayout` `<style>` | yes |
| `src/layouts/BaseLayout.astro:36-43` | homepage pre-paint map, read from `localStorage` | yes |
| `src/components/Footer.astro:58-65` | homepage on-change map | yes |
| `public/{game}/{n}/variables.css` × 7 | nothing references these files | **no** |
| `src/styles/global.css:2-5` | bare `:root` fallback (osrs/5's palette) | yes |

Each league's `backgroundColor` is additionally duplicated *within* its own JSON (top-level always
equals `theme.backgroundColor`), and `src/scripts/picker.ts:243` hardcodes a further `'#071022'`
fallback, bringing the total to seven. An eighth site consumes the JSON block rather than redefining it:
`src/pages/showcase.astro:42` ships `league.data.theme` into a JS payload that
`src/scripts/showcase.ts:181-192` applies as per-row inline styles.

### Drift already shipped

The JS maps disagree with the JSON for two of seven leagues, so choosing these themes on the
homepage previews colors the actual page never uses:

| Key | Var | JSON (what the page shows) | JS map (what the homepage previews) |
|---|---|---|---|
| `osrs/6` | `--nav-item-color` | `#7a0c0c` | `#cc0000` |
| `rs3/1` | `--nav-item-color` | `#9b1e14` | `#802010` |
| `rs3/1` | `--background-color` | `#0C0000` | `#080201` |

The bare `:root` default is a third disagreement: `global.css` defaults to osrs/5's cyan while both
JS maps default to `rs3/1`, so anything painting before JS uses the wrong theme.

### Constraints

1. **No flicker.** The homepage theme must be applied before first paint. Today an `is:inline` script
   in `<head>` runs synchronously and injects `<style id="theme-variables-inline">` with `!important`.
   Color data therefore has to be reachable synchronously from the initial HTML — which is why it got
   duplicated into JS in the first place.
2. **Per-element theming.** The showcase page renders many leagues' rows in one document, each row
   wearing a different league's colors. A one-theme-per-document mechanism cannot express this.

## Approach

Colors move into a dedicated stylesheet, and any element can select a theme via a `data-theme`
attribute. Separation of concerns: colors are styling, so they live in CSS, not content data.

Two alternatives were considered and rejected:

- **Class on `<html>`** (`.theme-rs3-2`) — functionally identical, but requires mangling the `/` out
  of the league key, creating two representations of one identity.
- **Keep the injected-`<style>` mechanism, generating it from `themes.css` at build** — needs a Vite
  plugin to parse CSS back into a JS map: real complexity to preserve a mechanism this design deletes.

### Selector strategy

Selectors are element-level (no `:root` prefix) so both `<html>` and individual showcase rows can
carry a theme. The default is wrapped in `:where()` to force zero specificity:

```css
:where(:root),                 /* 0,0,0 — default, always loses to an explicit theme */
[data-theme="rs3/1"] { … }     /* 0,1,0 */
```

Specificity is computed per selector in a list, so the `:where(:root)` match scores 0,0,0 while the
attribute match scores 0,1,0. Any `[data-theme]` therefore beats the default regardless of source
order — no `!important`, no ordering fragility.

Nested themes work by **inheritance, not specificity**: custom properties inherit, so a themed
`<div>` colors all its descendants. On the showcase page `<html>` carries the user's selected theme
while each row sets its own, and each row's descendants resolve to that row's values because the row
is the nearest ancestor defining them. This is not a cascade conflict between the two elements.

### Why it cannot flicker

| | Today | After |
|---|---|---|
| Picker page | JS-free (`<style>` server-rendered) | JS-free (attribute server-rendered) |
| Homepage, pre-paint | inline script builds and inserts a `<style>` element | inline script writes one attribute |

Both paths are synchronous in `<head>`, so first paint is already themed. The new path does strictly
less work before paint. Picker pages improve from JS-set to present-in-the-HTML, so they render
correctly with JS disabled.

**Assumption to verify, not trust:** that Astro bundles `themes.css` render-blocking rather than as a
deferred asset. `themes.css` is `@import`ed from `global.css` so the two land in one bundle. If
`dist/` shows it split out, the fallback is inlining the rules via a `<style>` in `BaseLayout`'s head
— same design, different emission.

## Components

### `src/styles/themes.css` (new)

The single source of truth: seven blocks keyed `{game}/{leagueNumber}`. `rs3/1` doubles as the
default, matching the existing JS default and eliminating the osrs/5-vs-rs3/1 inconsistency. Hex
values are normalized to lowercase.

```css
:where(:root),
[data-theme="rs3/1"] {
  --title-color: #d5281a;
  --nav-item-color: #9b1e14;
  --header-background-color: #160403;
  --background-color: #0c0000;
}
[data-theme="osrs/1"] { --title-color: #a3ce27; --nav-item-color: #6a8418; --header-background-color: #0f1406; --background-color: #060804; }
[data-theme="osrs/2"] { --title-color: #f9ebb3; --nav-item-color: #96896b; --header-background-color: #14120b; --background-color: #080704; }
[data-theme="osrs/4"] { --title-color: #cd7429; --nav-item-color: #7a451a; --header-background-color: #160b05; --background-color: #090402; }
[data-theme="osrs/5"] { --title-color: #8ce0ff; --nav-item-color: #598fa3; --header-background-color: #0b1933; --background-color: #071022; }
[data-theme="osrs/6"] { --title-color: #c33232; --nav-item-color: #7a0c0c; --header-background-color: #140202; --background-color: #0c0000; }
[data-theme="rs3/2"] { --title-color: #2fbf63; --nav-item-color: #1a8a4a; --header-background-color: #07170f; --background-color: #030b07; }
```

Values come from the JSON `theme` blocks, which are canonical — they are what visitors actually see
on a picker page. The drifted homepage previews for `rs3/1` and `osrs/6` are corrected to match.

**Property:** changing the site-wide default is a one-line edit — move `:where(:root),` onto another
block — rather than editing three files that currently hold three different fallbacks.

### `src/styles/global.css`

- Add `@import "./themes.css";` as the first line (CSS requires `@import` precede other rules).
- `:root` keeps only the non-themed `--font-size-*` vars; the four color vars are removed.
- `.showcase-row` (`:725`): `background-color: rgba(255,255,255,0.03)` becomes
  `background-color: var(--background-color)`, taking over what `showcase.ts` set inline.
- `.showcase-row` `border-left` (`:727`), `.showcase-row-title` (`:738`), and
  `.showcase-row-separator` (`:744`) already reference the themed vars and need no change.

### `src/layouts/BaseLayout.astro`

- New optional prop `themeKey?: string`; renders `<html lang="en" data-theme={themeKey}>`. When
  undefined Astro omits the attribute, so the default applies.
- The `enableThemeScript` inline script drops its 18 lines of color data:

```js
document.documentElement.dataset.theme = localStorage.getItem('selectedTheme') || 'rs3/1';
```

A stale `localStorage` key (e.g. `rs3/3`) now matches no block and falls through to the default
automatically; the current code needs an explicit `themes[saved] ? … : …` guard for that.

### `src/layouts/PickerLayout.astro`

- Delete the `themeCSS` template string and its `<style set:html>`.
- Drop the `theme` and `backgroundColor` props; add `themeKey`, forwarded to `BaseLayout`.

### `src/pages/[...slug].astro`

Replace `theme={data.theme}` and `backgroundColor={data.backgroundColor}` with
``themeKey={`${data.game}/${data.leagueNumber}`}``.

### `src/components/Footer.astro`

- Delete the themes map and the `applyTheme` style-element surgery.
- Build `<option>`s from `getCollection('leagues')`: dedupe by `{game}/{leagueNumber}`, label =
  `name.replace(/ League$/, '')`, grouped by game (OSRS then RS3), sorted by league number. Verified
  to reproduce all seven current labels character-for-character, so the dropdown is visually
  unchanged — but a new league can never again show a stale hardcoded label.
- On change: write `localStorage` and set `document.documentElement.dataset.theme`.
- If the saved key matches no option, fall back to `rs3/1` so the select never renders blank.

### `src/pages/showcase.astro`

Replace the `theme` object in `LeagueEntry` and its payload with
``themeKey: `${league.data.game}/${league.data.leagueNumber}` ``.

### `src/scripts/showcase.ts`

In `renderBuildRow`, replace the four inline-style writes (`:181`, `:182`, `:186`, `:192`) with:

```ts
row.dataset.theme = build.themeKey;
```

The existing CSS then resolves each row's colors by inheritance. `BuildData`'s `theme` field becomes
`themeKey: string`.

### `src/scripts/picker.ts`

Read the export background from the cascade instead of `PICKER_CONFIG`:

```ts
const bg = getComputedStyle(document.documentElement)
  .getPropertyValue('--background-color').trim();
```

Covers the two consumers at `:377` and `:397` and removes the hardcoded `'#071022'` fallback at
`:243`. `exportFilename` becomes the only `PICKER_CONFIG` field.

### `src/content/config.ts` and league JSON

Remove `theme` and top-level `backgroundColor` from `leagueBaseSchema`, then remove both keys from
all nine JSON files. `game`, `leagueNumber`, and `name` remain — `Footer` and `showcase` need them.

### Deletions and docs

- Delete `public/{game}/{n}/variables.css` (7 files) — unreferenced.
- `CLAUDE.md`: the "Theme System" section describes `variables.css` as live and the "Adding a New
  League" step 3 instructs adding one. Both are stale. Replace with: add a `[data-theme=…]` block to
  `src/styles/themes.css`.

## Data flow

- **Picker page:** JSON → `[...slug].astro` → `PickerLayout` → `BaseLayout` → `<html data-theme="rs3/2">`
  → matching `themes.css` block. Pure CSS, no JS.
- **Homepage:** `themes.css` ships all seven → pre-paint script sets `data-theme` from `localStorage`
  → `Footer` change sets attribute + `localStorage`.
- **Showcase:** page chrome themed from `localStorage` as above; each row sets its own `data-theme`
  and its descendants inherit those values.
- **Export:** `themes.css` → computed `--background-color` → html2canvas.

## Verification

Structural criterion: **no hex literal for these four vars survives outside `themes.css`.** That is
what makes drift impossible rather than merely fixed, and it is greppable.

1. `npm run build` completes clean.
2. `dist/` HTML: theme rules present in `<head>`; `data-theme` server-rendered on each picker page.
3. Playwright over all 9 picker pages: computed `--title-color` and `--background-color` equal the
   `themes.css` expectation. This is exactly the test that would have caught the shipped drift.
4. Homepage: cycle all 7 options, asserting computed vars change and persist across reload.
5. Showcase: load a multi-league set of share URLs and confirm each row renders its own league's
   colors, with rows differing from each other and from the page chrome.
6. JS disabled: picker pages still themed correctly, proving the server-rendered path.
7. Export one PNG from a picker page and confirm its background matches the page.

## Intentional visual changes

All five follow from decisions recorded above and should be eyeballed before merge.

1. Homepage preview of Catalyst: nav `#802010` → `#9b1e14`, bg `#080201` → `#0c0000` (JSON canonical).
2. Homepage preview of Demonic Pacts: nav `#cc0000` → `#7a0c0c` (JSON canonical).
3. osrs/6 relics page and its exports: bg `#070101` → `#0c0000`, standardizing osrs/6 on one
   background across relics and pacts.
4. Default palette before JS runs: osrs/5 cyan → rs3/1 red.
5. Showcase row separators: currently `showcase.ts:192` overrides them to the league's
   `titleColor`, while `.showcase-row-separator` CSS asks for `--nav-item-color`. Dropping the inline
   override makes the CSS intent win, so separators become nav-item colored.

## Out of scope

- Any part of the in-progress site redesign. This refactor is deliberately not shaped around it;
  its value is that a reskin would then have one file to touch.
- Navbar, sidebar, and component-level colors that are not one of the four themed vars.
