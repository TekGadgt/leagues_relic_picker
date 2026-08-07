# Codebase Structure

**Analysis Date:** 2026-08-01

## Directory Layout

```
leagues_relic_picker/
├── .astro/                 # Astro build cache
├── .planning/
│   └── codebase/           # GSD codebase analysis documents
├── docs/                   # Project planning docs (superpowers)
├── public/                 # Static assets served at root
│   ├── assets/
│   │   ├── icons/          # SVG icons
│   │   └── placeholders/   # Fallback relic images
│   ├── osrs/
│   │   ├── 1/              # Twisted League assets
│   │   ├── 2/              # Trailblazer League assets
│   │   ├── 4/              # Trailblazer Reloaded assets
│   │   ├── 5/              # Raging Echoes assets
│   │   │   ├── masteries/
│   │   │   └── relics/
│   │   └── 6/              # Demonic Pacts assets
│   │       ├── pacts/
│   │       └── relics/
│   └── rs3/
│       ├── 1/              # Catalyst League assets
│       └── 2/              # TBD RS3 league assets
├── scripts/                # Build/verification Node scripts
├── src/
│   ├── components/         # Astro UI components
│   ├── content/
│   │   ├── config.ts       # Content collection schema
│   │   └── leagues/        # League JSON data files
│   ├── layouts/            # Astro page layouts
│   ├── pages/              # Astro routes
│   ├── scripts/            # Client-side TypeScript
│   └── styles/             # Global and theme CSS
├── astro.config.mjs        # Astro configuration
├── netlify.toml            # Netlify build settings
├── package.json            # Dependencies and scripts
├── README.md               # User-facing documentation
└── tsconfig.json           # TypeScript configuration
```

## Directory Purposes

**`src/pages/`:**
- Purpose: Astro file-based routing.
- Contains: `.astro` pages.
- Key files: `src/pages/index.astro`, `src/pages/[...slug].astro`, `src/pages/showcase.astro`.

**`src/layouts/`:**
- Purpose: Shared page shells.
- Contains: `BaseLayout.astro` (HTML document), `PickerLayout.astro` (picker page wrapper).
- Key files: `src/layouts/BaseLayout.astro`, `src/layouts/PickerLayout.astro`.

**`src/components/`:**
- Purpose: Reusable UI pieces rendered by layouts/pages.
- Contains: Astro components for chrome and item rendering.
- Key files: `src/components/ItemGrid.astro`, `src/components/RelicItem.astro`, `src/components/PactGraph.astro`, `src/components/Navbar.astro`, `src/components/Footer.astro`.

**`src/content/leagues/`:**
- Purpose: Data source for every picker route.
- Contains: One JSON file per game/league/page-type combination.
- Key files: `src/content/leagues/osrs-5-relics.json`, `src/content/leagues/osrs-6-pacts.json`, `src/content/config.ts`.

**`src/scripts/`:**
- Purpose: Client-side interactivity.
- Contains: TypeScript modules loaded by pages/layouts.
- Key files: `src/scripts/picker.ts`, `src/scripts/pact-graph.ts`, `src/scripts/showcase.ts`, `src/scripts/utils.ts`.

**`src/styles/`:**
- Purpose: Styling and theming.
- Contains: `global.css` (layout & component styles), `themes.css` (per-league CSS custom properties).
- Key files: `src/styles/global.css`, `src/styles/themes.css`.

**`public/`:**
- Purpose: Static assets copied directly to the build output root.
- Contains: League logos, posters, relic/mastery/pact PNGs.
- Key files: `public/osrs/{n}/logo.png`, `public/osrs/{n}/relics/*.png`, `public/osrs/5/masteries/*.png`, `public/osrs/6/pacts/*.png`.

**`scripts/`:**
- Purpose: Build-time validation outside Astro's pipeline.
- Contains: `scripts/verify-themes.mjs`.

## Key File Locations

**Entry Points:**
- `src/pages/index.astro`: Homepage.
- `src/pages/[...slug].astro`: Generates every picker route at build time.
- `src/pages/showcase.astro`: Showcase page.
- `src/scripts/picker.ts`: Main client script for picker pages.
- `src/scripts/showcase.ts`: Client script for showcase page.

**Configuration:**
- `astro.config.mjs`: Static output, site URL, trailing slashes, sitemap integration.
- `tsconfig.json`: Extends Astro strict config.
- `netlify.toml`: Build command and Node version.
- `src/content/config.ts`: Content collection schema.

**Core Logic:**
- `src/pages/[...slug].astro`: Route generation and layout dispatch.
- `src/components/ItemGrid.astro`: Renders grouped items.
- `src/scripts/picker.ts`: Selection state, URL sync, sidebar, export.
- `src/scripts/pact-graph.ts`: Pan/zoom graph interaction.
- `src/scripts/showcase.ts`: Multi-build preview and export.
- `scripts/verify-themes.mjs`: Theme invariant validation.

**Testing:**
- Not detected. No test files, test runners, or test scripts are present.

## Naming Conventions

**Files:**
- Astro components: PascalCase matching component name, e.g., `DetailSidebar.astro`, `ExportButton.astro`.
- Client scripts: kebab-case or camelCase descriptive nouns, e.g., `picker.ts`, `pact-graph.ts`, `showcase.ts`.
- Data files: `{game}-{number}-{pageType}.json`, e.g., `osrs-5-relics.json`, `rs3-1-relics.json`.
- Styles: `global.css`, `themes.css`.

**Directories:**
- `src/components/`, `src/layouts/`, `src/pages/`, `src/scripts/`, `src/styles/`: pluralized by Astro convention.
- `public/osrs/{number}/` and `public/rs3/{number}/`: lowercase game slug + numeric league directory.
- Asset subdirectories use plural names matching page type: `relics/`, `masteries/`, `pacts/`.

**HTML/CSS classes:**
- Lowercase hyphenated, e.g., `detail-sidebar`, `nav-link`, `pact-node`.

**CSS custom properties:**
- `--{context}-{property}`, e.g., `--background-color`, `--header-background-color`, `--title-color`.

## Where to Add New Code

**New League:**
1. Data: `src/content/leagues/{game}-{n}-{pageType}.json`
2. Assets: `public/{game}/{n}/relics/`, `public/{game}/{n}/logo.png`, `public/{game}/{n}/poster.png`
3. Theme: `src/styles/themes.css` — add `[data-theme="{game}/{n}"]` block
4. Navigation: `src/pages/index.astro` — add `<a>` link under the correct OSRS/RS3 column
5. Validation: run `npm run verify:themes` (already part of `npm run build`)

**New Page Type (e.g., a future "blessings" page):**
- Schema: extend `src/content/config.ts` `pageType` enum and create a new layout schema if needed.
- Route logic: update slug construction in `src/pages/[...slug].astro` (lines 12-17) and `showcase.ts` URL parsing regex (line 67).
- Component: add a new item component alongside `RelicItem.astro`/`MasteryItem.astro` if the visual treatment differs.
- Navigation: add links in `src/pages/index.astro`.

**New Client Feature:**
- Shared utilities: `src/scripts/utils.ts`
- Picker-specific behavior: `src/scripts/picker.ts`
- Graph-specific behavior: `src/scripts/pact-graph.ts`
- Showcase-specific behavior: `src/scripts/showcase.ts`

**New UI Component:**
- Implementation: `src/components/{ComponentName}.astro`
- Import in the layout or page that uses it.

**New Build-Time Validation:**
- Add to `scripts/verify-themes.mjs` or create a new script and wire it into `package.json`.

## Special Directories

**`.astro/`:**
- Purpose: Astro build cache and generated types.
- Generated: Yes.
- Committed: No (present in repo but should typically be ignored).

**`dist/`:**
- Purpose: Static build output deployed to Netlify.
- Generated: Yes.
- Committed: Yes (currently tracked in git, but contains generated files).

**`public/`:**
- Purpose: Static assets referenced by relative paths in data files and components.
- Generated: No.
- Committed: Yes.

**`node_modules/`:**
- Purpose: Installed dependencies.
- Generated: Yes.
- Committed: No.

---

*Structure analysis: 2026-08-01*
