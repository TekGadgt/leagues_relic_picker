<!-- refreshed: 2026-08-01 -->
# Architecture

**Analysis Date:** 2026-08-01

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Static Pages                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  Homepage    │  │  Dynamic Picker  │  │   Showcase     │ │
│  │src/pages/    │  │src/pages/[...slug]│  │src/pages/      │ │
│  │index.astro   │  │     .astro        │  │showcase.astro  │ │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬───────┘ │
└─────────┼───────────────────┼─────────────────────┼─────────┘
          │                   │                     │
          ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                        Layout Layer                          │
│          src/layouts/BaseLayout.astro                        │
│          src/layouts/PickerLayout.astro                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Component Layer                          │
│  Navbar  ItemGrid  RelicItem  MasteryItem  PactGraph         │
│  PactNode  DetailSidebar  ExportButton  Footer               │
│          src/components/*.astro                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Client Script Layer                       │
│         src/scripts/picker.ts                                │
│         src/scripts/pact-graph.ts                            │
│         src/scripts/showcase.ts                              │
│         src/scripts/utils.ts                                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Content Collection / Data Store                 │
│              src/content/leagues/*.json                      │
│              src/content/config.ts (Zod schema)              │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| BaseLayout | Page shell, HTML document, theme plumbing, OG meta, Cloudflare analytics | `src/layouts/BaseLayout.astro` |
| PickerLayout | Picker page wrapper: navbar, editable title, export button, detail sidebar, picker/pact scripts | `src/layouts/PickerLayout.astro` |
| Navbar | Top navigation, mobile hamburger menu, instructions, GitHub link | `src/components/Navbar.astro` |
| ItemGrid | Renders grouped items as columns (relics) or rows (masteries) | `src/components/ItemGrid.astro` |
| RelicItem | Single relic DOM node with data attributes for JS | `src/components/RelicItem.astro` |
| MasteryItem | Single mastery DOM node with data attributes for JS | `src/components/MasteryItem.astro` |
| PactGraph | Pan/zoom graph container for pact nodes and edges | `src/components/PactGraph.astro` |
| PactNode | Individual pact node with active/inactive image states | `src/components/PactNode.astro` |
| DetailSidebar | Empty shell populated by picker.ts on right-click/double-tap | `src/components/DetailSidebar.astro` |
| ExportButton | Export and Add-to-Showcase buttons | `src/components/ExportButton.astro` |
| Footer | Social links and theme selector populated from content collection | `src/components/Footer.astro` |

## Pattern Overview

**Overall:** Static-site generator (Astro) with zero server runtime; all interactivity is progressive-enhancement vanilla TypeScript on the client.

**Key Characteristics:**
- Content-driven routing via Astro content collections (`src/content/leagues/*.json`).
- Data is the source of truth for routes, page metadata, theme keys, and navigation.
- State is persisted entirely in the URL (`?selected=...&title=...`) for shareability.
- Theme colors live in exactly one file (`src/styles/themes.css`) and are validated at build time.
- Client scripts are feature-cohesive: `picker.ts` handles selection/sidebar/export, `pact-graph.ts` handles graph interaction, `showcase.ts` handles multi-build previews.

## Layers

**Pages:**
- Purpose: Define routes and compose layouts/components.
- Location: `src/pages/`
- Contains: Astro pages (`index.astro`, `[...slug].astro`, `showcase.astro`).
- Depends on: Layouts, components, Astro content collections.
- Used by: Astro build (`astro build`).

**Layouts:**
- Purpose: Provide common HTML shells and page-specific wrappers.
- Location: `src/layouts/`
- Contains: `BaseLayout.astro`, `PickerLayout.astro`.
- Depends on: Components, styles (`global.css`, `themes.css`).
- Used by: Pages.

**Components:**
- Purpose: Render league items, navigation, sidebar, and chrome.
- Location: `src/components/`
- Contains: `.astro` UI components.
- Depends on: Data passed via props; `Footer.astro` queries the content collection at build time.
- Used by: Layouts and pages.

**Client Scripts:**
- Purpose: Add behavior after hydration.
- Location: `src/scripts/`
- Contains: `picker.ts`, `pact-graph.ts`, `showcase.ts`, `utils.ts`.
- Depends on: DOM rendered by components; `html2canvas` loaded from CDN; pre-bundled data serialized into `window.LEAGUE_DATA` on showcase.
- Used by: `PickerLayout.astro` and `showcase.astro`.

**Data / Content:**
- Purpose: Store league definitions, items, and graph geometry.
- Location: `src/content/leagues/` and `src/content/config.ts`
- Contains: Zod schema and one JSON file per league/page combination.
- Depends on: Nothing.
- Used by: Pages, layouts, components, validation script.

**Styles:**
- Purpose: Global layout and per-league theming.
- Location: `src/styles/`
- Contains: `global.css`, `themes.css`.
- Depends on: CSS custom properties defined in `themes.css`.
- Used by: `BaseLayout.astro` via global `<style is:global>` import.

## Data Flow

### Primary Request Path (Picker Page)

1. **Route generation** — `src/pages/[...slug].astro` calls `getStaticPaths()` and `getCollection('leagues')` at build time, emitting one static route per JSON file.
2. **Layout render** — `PickerLayout.astro` receives `meta`, `themeKey`, `exportFilename`, and `pageType` as props and wraps the page in `BaseLayout`.
3. **Item render** — `ItemGrid.astro` maps grouped items to `RelicItem` or `MasteryItem`; `PactGraph.astro` renders nodes and edges for graph layout.
4. **Hydration** — `PickerLayout.astro` injects `window.PICKER_CONFIG` and loads `picker.ts` (and `pact-graph.ts`).
5. **State initialization** — `picker.ts` reads `?selected=` and `?title=` from `URLSearchParams`, applies `selected` classes and title text, then attaches click/right-click/double-tap handlers.
6. **Interaction** — Selecting/deselecting mutates DOM classes and calls `history.replaceState` to update the URL without a page reload.
7. **Export** — `html2canvas` captures `#main` into a PNG; the export background is pulled from the current theme's `--background-color`.

### Secondary Flow (Showcase Page)

1. **Data pre-bundling** — `showcase.astro` reads all leagues via `getCollection('leagues')` and serializes a flat `Record<string, LeagueData>` into `window.LEAGUE_DATA`.
2. **User input** — URLs are pasted into `#urlInput`.
3. **Parsing** — `showcase.ts` parses each URL into `leagueKey`, `selectedIds`, and `title`.
4. **Rendering** — Build rows are generated via `renderBuildRow()`; each row sets its own `data-theme` so multiple league color schemes can coexist.
5. **Export** — `html2canvas` captures `#showcaseContainer` at scale 2.

### Theme Flow

1. `themes.css` defines `[data-theme="{game}/{number}"]` blocks.
2. Picker pages receive `themeKey` from data and `BaseLayout` renders `<html data-theme={themeKey}>`.
3. Homepage and showcase set `dataset.theme` from `localStorage.selectedTheme` in an inline, render-blocking script to avoid flash of un-themed content.
4. The theme dropdown in `Footer.astro` updates `localStorage` and `dataset.theme` on change.
5. `npm run verify:themes` (via `scripts/verify-themes.mjs`) asserts every league key has a CSS block and no theme color appears elsewhere.

**State Management:**
- Selection state is stored in the URL query string only; there is no global JS state object.
- `localStorage` is used only for `selectedTheme` and the temporary `showcaseUrls` list.

## Key Abstractions

**Content Collection Entry (`league`):**
- Purpose: A single page of content for a game/league/page-type combination.
- Examples: `src/content/leagues/osrs-5-relics.json`, `src/content/leagues/osrs-6-pacts.json`.
- Pattern: One JSON file per rendered route; schema union of `gridLayoutSchema` and `graphLayoutSchema` in `src/content/config.ts`.

**Item Data Attributes:**
- Purpose: Bridge server-rendered HTML and client-side interactivity without re-hydrating a framework component tree.
- Examples: `data-label`, `data-image-src`, `data-items` on `RelicItem`, `MasteryItem`, `PactNode`.
- Pattern: Vanilla JS reads these attributes to open the detail sidebar and update selection state.

**Theme Key (`{game}/{leagueNumber}`):**
- Purpose: Uniquely identify a league's visual theme across routing, CSS, and per-row showcase rendering.
- Examples: `osrs/5`, `rs3/1`.
- Pattern: Shared by multiple page types for the same league (e.g., `osrs/5` covers both relics and masteries pages).

## Entry Points

**Build-time entry point:**
- Location: `src/pages/[...slug].astro`
- Triggers: `astro build`
- Responsibilities: Generates every league picker route from the content collection.

**Homepage entry point:**
- Location: `src/pages/index.astro`
- Triggers: Direct navigation to `/`
- Responsibilities: Static landing page with league navigation; reads saved theme from `localStorage`.

**Showcase entry point:**
- Location: `src/pages/showcase.astro`
- Triggers: Navigation to `/showcase/`
- Responsibilities: Pre-bundles all league data, renders URL input UI, delegates preview/export logic to `showcase.ts`.

**Client entry point (picker):**
- Location: `src/scripts/picker.ts`
- Triggers: Loaded by `PickerLayout.astro` on every picker page.
- Responsibilities: Selection toggling, URL state sync, detail sidebar, export, add-to-showcase.

**Client entry point (pact graph):**
- Location: `src/scripts/pact-graph.ts`
- Triggers: Loaded by `PickerLayout.astro` on every picker page (no-op when no graph is present).
- Responsibilities: Pan, zoom, keyboard controls, and temporary transform reset for export.

## Architectural Constraints

- **Static output only:** `astro.config.mjs` sets `output: 'static'`. No server-side rendering or API routes exist.
- **CDN dependencies:** `html2canvas` and Cloudflare Insights are loaded from external CDNs; the build does not bundle them.
- **Single source of truth for themes:** `src/styles/themes.css` must contain every league theme. Adding a league without a corresponding block fails `npm run verify:themes`.
- **URL as state:** Because selections live in `URLSearchParams`, URLs are the only persistence/sharing mechanism. No backend stores builds.
- **Touch vs. pointer input divergence:** Relic/mastery pages use single click to toggle; pact nodes also use single click to toggle. On touch devices, single tap is delayed to detect double-tap for the sidebar.
- **Center pact node invariant:** `node1` is forced selected and cannot be deselected (`picker.ts` lines 60-64 and 81-83).
- **Global mutable state:** A small amount of module-level state exists in client scripts:
  - `tapState` in `src/scripts/picker.ts`.
  - Pan/zoom state in `src/scripts/pact-graph.ts`.
  - `currentSidebarElementId` in `src/scripts/picker.ts`.
- **No circular imports detected.**

## Anti-Patterns

### Inline event handling mixed with component scripts

**What happens:** `Navbar.astro` contains a component-level `<script>` that queries DOM elements by ID and attaches listeners. This is acceptable but fragile because it relies on global IDs rendered by the same component.
**Why it's wrong here:** There is no shadow DOM or scoped event delegation; multiple instances of `Navbar` on the same page would collide on `#navHamburger` and `#navMobileMenu`.
**Do this instead:** Use event delegation on a stable parent, or scope query selectors within the component's rendered subtree. In practice the site only renders one navbar per page, so this is documented rather than urgent.

### Runtime type assertions via `window as Window & { ... }`

**What happens:** `picker.ts`, `pact-graph.ts`, and `showcase.ts` cast `window` to add global properties rather than using module imports.
**Why it's wrong here:** It bypasses TypeScript's module boundaries and makes dependencies (e.g., `html2canvas`, `LEAGUE_DATA`) implicit.
**Do this instead:** For data passed from Astro, continue using `define:vars` to serialize small objects, but prefer importing shared utilities (`isTouchDevice`) via ES modules. For `html2canvas`, consider a tiny typed wrapper module instead of repeated `Window &` casts.

## Error Handling

**Strategy:** Fail fast at build time; degrade gracefully at runtime.

**Patterns:**
- Build-time validation: `astro check` and `scripts/verify-themes.mjs` run before every build (`npm run build` → `astro check && astro build && npm run verify:themes`).
- Runtime guards: Client scripts check for DOM element existence before attaching listeners (`if (!element) return`).
- Export fallbacks: If Web Share fails, the export falls back to a standard anchor download; if `html2canvas` is missing, an `alert()` is shown.
- URL parse failures in showcase produce an error row rather than crashing the whole preview (`renderBuildRow(build.error)` branch).

## Cross-Cutting Concerns

**Logging:** Direct `console.error` calls inside export catch blocks; no structured logging framework.

**Validation:** Zod schemas in `src/content/config.ts` validate league JSON at build time via Astro content collections.

**Analytics:** Cloudflare Web Analytics beacon loaded inline in `BaseLayout.astro` body.

---

*Architecture analysis: 2026-08-01*
