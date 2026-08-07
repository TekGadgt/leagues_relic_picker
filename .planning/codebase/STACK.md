# Technology Stack

**Analysis Date:** 2026-08-01

## Languages

**Primary:**
- TypeScript 5.7 — Client logic in `src/scripts/*.ts`, type-safe props in `src/components/*.astro`, content schema in `src/content/config.ts`
- Astro 5.2 — Component framework and static site generator for all pages and layouts
- CSS3 — Styling in `src/styles/global.css` (1430 lines) and `src/styles/themes.css`
- JSON — League data in `src/content/leagues/*.json`

**Secondary:**
- Node.js — Build-time tooling and `scripts/verify-themes.mjs` (ESM, built-ins only)
- HTML — Server-rendered markup via `.astro` components

## Runtime

**Environment:**
- Node.js (modern ESM runtime required by `scripts/verify-themes.mjs` and Astro CLI)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Astro 5.2.5 (`astro`) — Static site generator with Islands-style architecture
- `@astrojs/sitemap` 3.7.0 — Automatic sitemap generation for static output

**Build/Dev:**
- Astro CLI — `dev`, `build`, `preview`, `check` commands defined in `package.json`
- TypeScript 5.7.3 — Type checking (`@astrojs/check`)
- Node ESM scripts — Theme invariant verification via `scripts/verify-themes.mjs`

**Testing:**
- Not detected — No test runner, test files, or test scripts in `package.json`

## Key Dependencies

**Critical:**
- `html2canvas` 1.4.1 — Client-side PNG export for picker/share images. Loaded from CDN (`cdnjs.cloudflare.com`) at runtime in `src/layouts/PickerLayout.astro` and `src/pages/showcase.astro`; also listed as a production dependency in `package.json`

**Infrastructure:**
- `@astrojs/sitemap` 3.7.0 — Sitemap production
- `@astrojs/check` 0.9.4 — Astro type-checking wrapper

## Configuration

**Environment:**
- No runtime environment variables detected
- Configuration is compile-time in `astro.config.mjs`
- `.env` files not present

**Build:**
- `astro.config.mjs` — Static output, site URL, trailing slashes, directory format, sitemap integration
- `tsconfig.json` — Extends `astro/tsconfigs/strict`, enables `strictNullChecks`
- `package.json` scripts:
  - `dev`/`start`: `astro dev`
  - `build`: `astro check && astro build && npm run verify:themes`
  - `preview`: `astro preview`
  - `verify:themes`: `node scripts/verify-themes.mjs`

## Platform Requirements

**Development:**
- Node.js with ESM support
- npm
- Modern browser for local dev (Astro dev server)

**Production:**
- Static hosting only — Astro `output: "static"`
- Deployed to Netlify (per `README.md` badge and instructions)
- Custom domain: `https://relics.runetools.lol`

---

*Stack analysis: 2026-08-01*
