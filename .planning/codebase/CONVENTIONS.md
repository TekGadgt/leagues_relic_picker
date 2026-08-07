# Coding Conventions

**Analysis Date:** 2026-08-01

## Naming Patterns

**Files:**
- Astro components: PascalCase (`Navbar.astro`, `PickerLayout.astro`, `RelicItem.astro`)
- Client scripts: camelCase (`picker.ts`, `showcase.ts`, `pact-graph.ts`, `utils.ts`)
- Build/utility scripts: camelCase or descriptive (`verify-themes.mjs`)
- Content data: kebab-case matching the league key (`osrs-6-pacts.json`)
- Layout components: PascalCase with `Layout` suffix (`BaseLayout.astro`, `PickerLayout.astro`)

**Functions:**
- Use camelCase for all functions (`initPicker`, `parseShareURL`, `getHighestPerGroup`, `isTouchDevice`)
- Helper predicates start with `is` (`isTouchDevice`, `isDetailSidebarOpen`)
- Initialization functions start with `init` (`initPicker`, `initShowcase`, `initPactGraph`)

**Variables:**
- camelCase for locals and parameters
- UPPER_SNAKE_CASE for true constants (`DOUBLE_TAP_THRESHOLD = 300`, `CANVAS_SIZE = 5000`, `MIN_SCALE = 0.05`)

**Types:**
- TypeScript `interface` preferred over `type` for object shapes (`interface Props`, `interface LeagueData`, `interface ParsedURL`)
- Union types use `type` aliases (`type ToolTipItem = string | string[]`)
- Astro component props are declared as `interface Props` in the frontmatter

**CSS Classes:**
- Mixed conventions exist; prefer kebab-case for new classes
- Existing patterns:
  - kebab-case: `detail-sidebar`, `nav-link-wrapper`, `navbar--no-instructions`
  - camelCase: `colContainer`, `rowContainer`, `relicImg`, `masteryLabel`, `showcase-row`
- BEM-like modifiers use `--`: `navbar--no-instructions`, `nav-instructions--desktop`

## Code Style

**Formatting:**
- No formatter configured (no `.prettierrc`, Prettier dependency, or Biome config)
- Manual formatting observed:
  - 2-space indentation
  - Single quotes in TypeScript files (`'astro:content'`, `'./utils'`)
  - Double quotes in `astro.config.mjs` (inconsistent)
- Keep Astro component frontmatter compact; prefer multiline destructuring when props exceed ~4

**Linting:**
- No ESLint, Biome, or other linter configured
- TypeScript strict mode is enabled via `tsconfig.json`:
  - Extends `astro/tsconfigs/strict`
  - Explicitly enables `strictNullChecks`
- Treat `astro check` (run as part of `npm run build`) as the type-checking gate

## Import Organization

**Order:**
1. Astro built-ins (`astro:content`)
2. Third-party packages (`html2canvas` is loaded via CDN, not imported)
3. Relative project imports (`./utils`, `./RelicItem.astro`, `../layouts/BaseLayout.astro`)

**Path Aliases:**
- No path aliases configured
- Use relative paths for all imports

**Module Pattern:**
- Client scripts that attach global listeners end with `export {};` to keep them modules:
  - `src/scripts/picker.ts`
  - `src/scripts/showcase.ts`
  - `src/scripts/pact-graph.ts`
- Astro frontmatter scripts do not need this

## Error Handling

**Strategy:**
- Graceful degradation for DOM operations: guard with `if (!element) return;`
- URL parsing wraps in `try/catch` and returns `null` on failure (`src/scripts/showcase.ts:61-91`)
- User-facing errors surface via `window.alert()` after logging to `console.error`
- `JSON.parse()` of potentially untrusted data (`localStorage`, `dataset.items`) is not wrapped; wrap these when adding new parsers

**Patterns:**
- Prefer early returns over nested `if` blocks
- Use optional chaining (`?.`) for DOM traversal
- Avoid throwing in client scripts; return nullable results instead

## Logging

**Framework:** `console`

**Patterns:**
- Log developer-facing errors with `console.error` (e.g., export failures)
- Do not log user state to console in production
- `scripts/verify-themes.mjs` uses `console.error` for failures and `console.log` for success

## Comments

**When to Comment:**
- Explain non-obvious business rules (e.g., "Force center pact node to always be selected")
- Document URL parsing patterns with examples
- Justify architectural invariants (e.g., theme colours live only in `themes.css`)
- Keep comments above the code they describe

**JSDoc/TSDoc:**
- Not used consistently
- Some functions in `showcase.ts` have JSDoc-style block comments (`/** Render a single build row */`)
- Astro component props are typed via `interface Props`, not JSDoc

## Function Design

**Size:**
- Functions tend to be large and multi-purpose (e.g., `initPicker` in `src/scripts/picker.ts` is ~220 lines)
- Prefer extracting smaller helpers when adding new features

**Parameters:**
- Pass related primitives together rather than large option bags
- Example: `updateURLParams(elements: HTMLCollectionOf<Element>, titleSelector: string)`

**Return Values:**
- DOM helpers return `void` and mutate state
- Data helpers return arrays or nullable objects (`ParsedURL | null`)

## Module Design

**Exports:**
- Utility modules use named exports (`export function isTouchDevice()` in `src/scripts/utils.ts`)
- Client entry scripts export nothing (use `export {};`)
- Content config exports `collections`

**Barrel Files:**
- Not used
- Import components directly from their source files

## Astro-Specific Conventions

**Scripts:**
- Use `<script is:inline>` for scripts that must run before hydration or rely on `localStorage`
- Use `define:vars={{ exportFilename }}` to pass build-time values to inline scripts
- Load third-party libraries from CDN with SRI hashes (`html2canvas` in `PickerLayout.astro` and `showcase.astro`)

**Styling:**
- Global CSS imported in `BaseLayout.astro` via `<style is:global>` with `@import "../styles/global.css";`
- Component-scoped styles are not used; all styles live in `src/styles/global.css` or `src/styles/themes.css`

**Data:**
- League data is stored as JSON in `src/content/leagues/` and validated via `src/content/config.ts` using Astro's `defineCollection` and Zod

---

*Convention analysis: 2026-08-01*
