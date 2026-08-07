# External Integrations

**Analysis Date:** 2026-08-01

## APIs & External Services

**Analytics/Insights:**
- Cloudflare Web Analytics — Embedded in every page via `BaseLayout.astro`
  - Script: `https://static.cloudflareinsights.com/beacon.min.js`
  - Token: `a488248dbb94443d840feb6ed005bc1b`
  - Note: Token is visible in rendered HTML; this is standard for client-side analytics beacons

**CDN Assets:**
- cdnjs.cloudflare.com — Loads `html2canvas` 1.4.1 in `src/layouts/PickerLayout.astro` and `src/pages/showcase.astro` for client-side image export

**Social/Community Links:**
- GitHub repository link (`https://github.com/TekGadgt/leagues_relic_picker`) in `Navbar.astro` and `Footer.astro`
- Discord invite link (`https://discord.gg/PrpwU9mydm`) in `Footer.astro`
- Personal page link (`https://tekgadgt.omg.lol/`) in `Footer.astro`

## Data Storage

**Databases:**
- None — All data is static JSON in `src/content/leagues/*.json`

**File Storage:**
- Local filesystem only — Game assets in `public/osrs/`, `public/rs3/`, `public/assets/`, and `public/poster.png`

**Caching:**
- Browser `localStorage` — Used for theme preference (`selectedTheme`) in `Footer.astro` and `BaseLayout.astro`; used for showcase URL list (`showcaseUrls`) in `src/scripts/picker.ts` and `src/scripts/showcase.ts`

## Authentication & Identity

**Auth Provider:**
- None — No user accounts, login, or sessions

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, LogRocket, or similar service

**Logs:**
- Client console logs only (`console.error` in `src/scripts/picker.ts` and `src/scripts/showcase.ts`)

## CI/CD & Deployment

**Hosting:**
- Netlify — Auto-deploy on pushes to main branch (per `README.md`)

**CI Pipeline:**
- Not detected — No `.github/workflows/` or other CI configuration found

## Environment Configuration

**Required env vars:**
- None — The application is fully static with no build-time secrets

**Secrets location:**
- None detected
- Cloudflare analytics token is hardcoded in `src/layouts/BaseLayout.astro` (public by design)

## Webhooks & Callbacks

**Incoming:**
- None — Static site with no server runtime

**Outgoing:**
- None

---

*Integration audit: 2026-08-01*
