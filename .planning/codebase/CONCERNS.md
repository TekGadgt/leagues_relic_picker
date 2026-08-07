# Codebase Concerns

**Analysis Date:** 2026-08-01

## Tech Debt

**No automated test or lint infrastructure:**
- Issue: The project has no test framework, no lint config, and no formatting config. The only quality gate is `npm run build` (`astro check && astro build && npm run verify:themes`).
- Files: `package.json`, repo root.
- Impact: Regressions in client-side interactivity (`src/scripts/picker.ts`, `src/scripts/showcase.ts`, `src/scripts/pact-graph.ts`) are only caught by manual browsing or build-time TypeScript checks, which miss runtime logic errors.
- Fix approach: Add a test runner (Vitest is the lightest fit for an Astro/Vite project) and at least unit tests for URL parsing, item lookup, and theme verification. Add ESLint/Prettier or Biome to enforce style.

**Monolithic global stylesheet:**
- Issue: `src/styles/global.css` is 1,430 lines and mixes component styles, layout styles, theme overrides, responsive media queries, export overrides, and dead commented-out rules (tooltip block at lines 222–240 and 350–354).
- Files: `src/styles/global.css`.
- Impact: Styles for unrelated features are tightly coupled; adding a new league or layout risks unintended side effects. Dead rules increase noise.
- Fix approach: Split into component-scoped files (e.g., `navbar.css`, `sidebar.css`, `pact-graph.css`, `showcase.css`) and import them from the relevant Astro components. Remove commented dead code.

**Duplicated image-export logic:**
- Issue: The html2canvas capture flow is implemented independently in `src/scripts/picker.ts` (lines 363–448) and `src/scripts/showcase.ts` (lines 325–418). Both handle Web Share fallback, blob generation, download, and state restoration, but the implementations differ (e.g., only picker resets the pact graph transform; error messages differ; showcase hardcodes `backgroundColor: '#000000'`).
- Files: `src/scripts/picker.ts`, `src/scripts/showcase.ts`.
- Impact: Bug fixes or UX improvements to export must be made twice and kept in sync.
- Fix approach: Extract a shared `exportToPng(element, filename, options)` helper in `src/scripts/utils.ts` and have both pages call it.

**Hard-coded pact graph assumptions:**
- Issue: `src/scripts/picker.ts` forces the element with `id="node1"` to stay selected (lines 60–64 and 81–82), and `updatePactCounter` hardcodes a 40-pact limit (lines 134–140). The pan/zoom constants (canvas size 5000px, mobile breakpoint 768, zoom step 0.02) are also hard-coded in `src/scripts/pact-graph.ts`.
- Files: `src/scripts/picker.ts`, `src/scripts/pact-graph.ts`.
- Impact: A future league with a different center node ID, different pact budget, or different graph dimensions will require fragile edits across multiple files.
- Fix approach: Drive these values from the league JSON (e.g., `graph.centerNodeId`, `graph.maxSelections`) or from `data-*` attributes rendered by `PactGraph.astro`.

**localStorage and `JSON.parse` without guards:**
- Issue: Multiple client scripts read `localStorage` and parse JSON without `try/catch`. A corrupted or manually edited `showcaseUrls` or `selectedTheme` value will throw during init and can leave the page partially broken.
- Files: `src/scripts/picker.ts:459–460`, `src/scripts/showcase.ts:428–430`, `src/layouts/BaseLayout.astro:39`, `src/components/Footer.astro:82–90`.
- Impact: Storage corruption = broken init; `selectedTheme` corruption on the homepage can cause a flash or JavaScript error.
- Fix approach: Wrap every `localStorage.getItem` + `JSON.parse` in `try/catch`; fall back to defaults and optionally clear the bad key.

**Tooltip data is round-tripped through JSON in HTML attributes:**
- Issue: `RelicItem.astro`, `MasteryItem.astro`, and `PactNode.astro` serialize `toolTipItems` with `JSON.stringify` into `data-items`, then `picker.ts` parses it with `JSON.parse` at lines 293 and 328. There is no schema validation or fallback if the attribute is malformed.
- Files: `src/components/RelicItem.astro`, `src/components/MasteryItem.astro`, `src/components/PactNode.astro`, `src/scripts/picker.ts`.
- Impact: A malformed JSON string in content data breaks the detail sidebar for that item.
- Fix approach: Validate JSON during build via the content schema, or wrap the parse in a helper that returns a safe default array.

## Known Bugs

**Showcase URL parser rejects URLs without a trailing slash:**
- Symptoms: Pasting a share URL like `https://relics.runetools.lol/osrs/1?selected=tier1-1` into the showcase textarea renders an "Invalid URL format" row.
- Files: `src/scripts/showcase.ts:61–68`.
- Trigger: The regex `/^\/(osrs|rs3)\/(\d+)(?:\/(masteries|pacts))?\/?$/` requires a leading slash but only makes the final slash optional; a URL with no path slash at all (after the origin) will fail because `new URL(urlString).pathname` will be `/osrs/1` if a slash is present, but `?selected=...` without a slash yields `/`? Actually the bug is more that the pathname must start with `/osrs/...`; if a user pastes `.../osrs/1?selected=...` it works. If they paste `.../osrs/1/?selected=...` it works. The real fragility is that any future route shape change breaks the parser.
- Workaround: Users must paste the exact URL copied from the picker page.
- Fix approach: Re-use the same slug logic Astro uses at build time, or normalize the URL before parsing.

**Cleared editable title shows no placeholder:**
- Symptoms: When the user deletes the title text, the title area becomes blank instead of showing a hint.
- Files: `src/styles/global.css:164–167`, `src/layouts/PickerLayout.astro:43`.
- Trigger: The CSS uses `content: attr(placeholder)`, but the `<h1>` has no `placeholder` attribute.
- Workaround: None; users see an empty title bar.
- Fix approach: Add `placeholder="Change Me"` to the title element, or change the CSS to use a static `content` value.

**Pact graph edges with missing endpoints are silently dropped:**
- Symptoms: An edge referencing a node ID that does not exist in the JSON simply does not render; there is no build-time or runtime warning.
- Files: `src/components/PactGraph.astro:50–65`.
- Trigger: A typo in `graph.edges` or a missing node entry.
- Workaround: Manual visual inspection of the built graph.
- Fix approach: Add a build-time validation step (or extend `scripts/verify-themes.mjs`) that asserts every `edge.from` and `edge.to` exists in `graph.nodes`.

## Security Considerations

**External analytics script without Subresource Integrity:**
- Risk: `BaseLayout.astro` loads the Cloudflare Insights beacon from `https://static.cloudflareinsights.com/beacon.min.js` with no `integrity` attribute. If that CDN is compromised, arbitrary JavaScript runs in the origin context.
- Files: `src/layouts/BaseLayout.astro:55–59`.
- Current mitigation: Script is loaded with `defer` and `referrerpolicy="no-referrer"`.
- Recommendations: Either add an SRI hash for the beacon script, load it via a privacy-friendly async loader, or move analytics to a tag manager with strict CSP.

**html2canvas uses `allowTaint: true`:**
- Risk: `allowTaint: true` lets the canvas become tainted by cross-origin images, which can violate CORS expectations and, in theory, allow pixel-reading of cross-origin content if combined with other weaknesses.
- Files: `src/scripts/picker.ts:404`, `src/scripts/showcase.ts:354`.
- Current mitigation: Assets are served from the same origin (`/osrs/...`, `/rs3/...`) and user-provided image URLs are not rendered.
- Recommendations: Since all game assets are local, set `allowTaint: false` and rely on `useCORS: true` for any future external images. Verify exports still work.

**No Content Security Policy:**
- Risk: The site uses multiple inline scripts (`is:inline` in `BaseLayout.astro`, `PickerLayout.astro`, `showcase.astro`, `Footer.astro`) and loads external CDNs. Without a CSP, XSS payloads are easier to inject and execute.
- Files: `src/layouts/BaseLayout.astro`, `src/layouts/PickerLayout.astro`, `src/pages/showcase.astro`, `src/components/Footer.astro`.
- Current mitigation: User input is escaped in `showcase.ts` (`escapeHtml`) and title content is set via `textContent`.
- Recommendations: Add a CSP via Netlify headers (`netlify.toml`) allowing `'self'`, the known CDN hosts, and hashes/nonce for inline scripts.

**Unvalidated localStorage parsing can crash init:**
- Risk: A malicious or broken value in `localStorage.showcaseUrls` or `localStorage.selectedTheme` can throw during `DOMContentLoaded`, blocking subsequent initialization.
- Files: `src/scripts/picker.ts:459–460`, `src/scripts/showcase.ts:428–430`, `src/layouts/BaseLayout.astro:39`, `src/components/Footer.astro:82–90`.
- Current mitigation: None.
- Recommendations: Wrap storage reads/parses in `try/catch` and clear invalid values.

## Performance Bottlenecks

**Pact graph preloads every active image synchronously:**
- Problem: `preloadPactImages` in `src/scripts/picker.ts:120–132` creates a new `Image` for every pact node's `activeSrc` and `activeFrame` at init time. For ~120 nodes this triggers many concurrent image requests.
- Files: `src/scripts/picker.ts:120–132`.
- Cause: No lazy loading or intersection observing; all active-state assets are fetched up front.
- Improvement path: Preload only the center/visible nodes, or rely on browser caching and load active images on first selection.

**Single large CSS bundle for all pages:**
- Problem: Every page loads the full `global.css` (1430 lines) including pact-graph-only and showcase-only rules.
- Files: `src/styles/global.css`, `src/layouts/BaseLayout.astro:63–65`.
- Cause: One global `@import "../styles/global.css";` in `BaseLayout`.
- Improvement path: Split layout/component CSS and import only the needed styles per page/layout.

**html2canvas export of large DOM:**
- Problem: Exporting the pact graph page captures a 1200×1200 pixel viewport with many nodes; exporting a showcase with many rows captures a very tall canvas. This is CPU and memory intensive, especially on mobile.
- Files: `src/scripts/picker.ts:363–448`, `src/scripts/showcase.ts:325–418`.
- Cause: html2canvas clones and rasterizes the entire element tree.
- Improvement path: Limit showcase export size, reduce `scale` for large captures, or use a server-side rendering path for generated images.

## Fragile Areas

**Generated pact graph data is hand-maintained and huge:**
- Files: `src/content/leagues/osrs-6-pacts.json` (2,607 lines), `src/components/PactGraph.astro`, `src/scripts/picker.ts`.
- Why fragile: A single typo in a node `id` breaks edge rendering silently. Image paths are hard-coded and not validated against `public/osrs/6/pacts/` contents. Content authors edit this file directly.
- Safe modification: Always run `npm run build` after JSON edits; visually inspect the graph; add a validation script before editing.
- Test coverage: No tests cover graph data integrity.

**Theme system correctness depends on a single verification script:**
- Files: `scripts/verify-themes.mjs`, `src/styles/themes.css`.
- Why fragile: If the script is skipped, deleted, or its regex drifts out of sync with Astro's build output, color drift can reappear. The script also only checks `src/` and `public/`; it cannot catch colors duplicated in third-party injected styles.
- Safe modification: Keep `verify:themes` in the build pipeline and run it in CI. Treat any failure as a build blocker.
- Test coverage: No unit tests for the verification script itself.

**Showcase depends on build-time payload shape:**
- Files: `src/pages/showcase.astro:97–99`, `src/scripts/showcase.ts:48–51`.
- Why fragile: `showcase.astro` serializes `leagueData` to `window.LEAGUE_DATA`. If the content schema changes (e.g., a field is renamed), `showcase.ts` may fail at runtime even though the build still succeeds.
- Safe modification: Share a TypeScript type between the server payload and client consumption, and add a runtime shape check before processing URLs.
- Test coverage: No tests for showcase URL parsing or rendering.

**Touch interaction detection is coarse:**
- Files: `src/scripts/utils.ts:1–3`, `src/scripts/picker.ts:269–333`.
- Why fragile: `isTouchDevice` checks `ontouchstart` and `navigator.maxTouchPoints`. Hybrid devices (touch laptops) are classified as touch, forcing the delayed single-tap/double-tap interaction on mouse users. There is no way to opt out.
- Safe modification: Use pointer events and detect double-tap via pointer-event timing instead of branching on device class.

## Scaling Limits

**localStorage showcase URL list is unbounded:**
- Current capacity: `localStorage` is typically limited to ~5 MB per origin.
- Limit: The "Add to Showcase" button appends the current URL with no deduplication beyond exact string matching and no maximum length. Long build lists or many saved URLs can exceed quota and throw.
- Scaling path: Cap the list (e.g., 50 URLs), validate each entry before saving, and surface an error when the cap is reached.

**Pact graph has no virtualization:**
- Current capacity: ~120 nodes render as individual DOM elements and SVG lines.
- Limit: Adding more leagues with graph layouts will linearly increase DOM size and init time.
- Scaling path: Implement viewport culling or a canvas-based renderer if node counts grow significantly.

## Dependencies at Risk

**html2canvas is effectively maintenance mode:**
- Risk: `html2canvas@^1.4.1` has open issues and a slow release cadence. It is loaded from a CDN in production.
- Impact: If the CDN is unavailable or the library has a breaking bug, image export breaks for all users.
- Migration plan: Vendor a pinned copy in `public/` or vendor through npm and bundle it, so export works offline and SRI can be enforced.

**No CI configuration in the repo:**
- Risk: Netlify runs `npm run build`, but there is no `.github/workflows` or equivalent to run tests, lint, or verification on pull requests.
- Impact: A contributor can merge code that builds locally but violates invariants or introduces runtime bugs.
- Migration plan: Add a GitHub Actions workflow that runs `npm ci`, `npm run build`, and any future test/lint commands.

## Missing Critical Features

**Automated tests:**
- Problem: There is no test command, no test files, and no test infrastructure.
- Blocks: Safe refactoring of `picker.ts`, `showcase.ts`, and `pact-graph.ts`.

**Accessibility for picker items:**
- Problem: Relics, masteries, and pacts are `<div>` elements with click/right-click handlers. They lack `role="button"`, `tabindex`, `aria-pressed`, and keyboard event handling.
- Files: `src/components/RelicItem.astro`, `src/components/MasteryItem.astro`, `src/components/PactNode.astro`, `src/scripts/picker.ts`.
- Blocks: Keyboard and screen-reader users cannot use the picker.

**Keyboard support for the detail sidebar:**
- Problem: The sidebar only opens on right-click (desktop) or double-tap (touch). There is no keyboard trigger, focus trap, or `Escape` close.
- Files: `src/components/DetailSidebar.astro`, `src/scripts/picker.ts`.
- Blocks: Keyboard users cannot view item details.

**Runtime error boundaries:**
- Problem: Client scripts have no global error handling or user-facing fallback if an exception occurs during export, URL parsing, or graph init.
- Files: `src/scripts/picker.ts`, `src/scripts/showcase.ts`, `src/scripts/pact-graph.ts`.
- Blocks: A single unhandled exception can leave the UI in a broken state.

## Test Coverage Gaps

**Client scripts are untested:**
- What's not tested: URL param read/write, selection toggling, sidebar open/close, image export, showcase URL parsing, and pact graph pan/zoom.
- Files: `src/scripts/picker.ts`, `src/scripts/showcase.ts`, `src/scripts/pact-graph.ts`, `src/scripts/utils.ts`.
- Risk: Behavior changes silently when refactoring; export/share regressions only noticed by users.
- Priority: High.

**Theme verification script is untested:**
- What's not tested: `scripts/verify-themes.mjs` failure modes (missing theme block, duplicated color, missing `data-theme` attribute, async stylesheet).
- Files: `scripts/verify-themes.mjs`.
- Risk: The script could pass while drift exists if its regex is wrong.
- Priority: Medium.

**JSON data integrity is untested:**
- What's not tested: Every item `src` resolves to an existing file; pact graph edges reference valid nodes; every league JSON conforms to the schema beyond `astro check`.
- Files: `src/content/leagues/*.json`, `src/content/config.ts`.
- Risk: Broken image links or dangling edges ship to production.
- Priority: Medium.

---

*Concerns audit: 2026-08-01*
