# Testing Patterns

**Analysis Date:** 2026-08-01

## Test Framework

**Runner:**
- Not configured
- No `vitest.config.*`, `jest.config.*`, or other test runner config exists
- No test framework in `package.json` dependencies or devDependencies

**Assertion Library:**
- Not configured

**Run Commands:**
```bash
# No test command exists
# Current package.json scripts:
#   npm run dev       # Astro dev server
#   npm run build     # Astro check + build + theme verification
#   npm run preview   # Preview production build
#   npm run verify:themes  # Run scripts/verify-themes.mjs
```

## Test File Organization

**Location:**
- No test files exist
- No `tests/`, `__tests__/`, or `src/**/*.test.*` files

**Naming:**
- Not applicable

**Structure:**
- Not applicable

## Test Structure

**Suite Organization:**
- Not applicable

**Patterns:**
- Not applicable

## Mocking

**Framework:**
- Not configured

**Patterns:**
- Not applicable

**What to Mock:**
- Browser APIs (`window`, `document`, `localStorage`, `navigator.share`, `html2canvas`) will need mocking for any client-side unit tests
- `getCollection('leagues')` will need mocking for Astro page tests

**What NOT to Mock:**
- Pure data transformation functions (e.g., `getHighestPerGroup`, `parseShareURL`) can be tested directly

## Fixtures and Factories

**Test Data:**
- Not configured
- Existing league JSON files in `src/content/leagues/` can serve as realistic fixtures once testing is added

**Location:**
- Create `tests/fixtures/` or `src/scripts/__fixtures__/` when adding tests

## Coverage

**Requirements:**
- None enforced
- No coverage threshold configured

**View Coverage:**
- Not applicable

## Test Types

**Unit Tests:**
- Not present
- High-value candidates for unit testing:
  - `src/scripts/utils.ts` (`isTouchDevice`)
  - `src/scripts/showcase.ts` (`parseShareURL`, `getHighestPerGroup`, `getAllSelectedItems`, `escapeHtml`)
  - `src/content/config.ts` Zod schema validation

**Integration Tests:**
- Not present
- Candidates:
  - `src/pages/[...slug].astro` static path generation
  - Theme verification script (`scripts/verify-themes.mjs`)

**E2E Tests:**
- Not used

## Existing Automated Checks

**Theme Verification:**
- `npm run verify:themes` runs `scripts/verify-themes.mjs`
- Validates:
  - Every league in `src/content/leagues/` has a `[data-theme="{game}/{number}"]` block in `src/styles/themes.css`
  - Each block sets `--title-color`, `--nav-item-color`, `--header-background-color`, `--background-color`
  - No theme hex colour appears outside `src/styles/themes.css` in `src/` or `public/`
  - Built pages carry a server-rendered `data-theme` attribute and load CSS containing all theme blocks
- This is the only automated quality gate in the project

## Recommended Testing Setup

**Suggested Stack:**
- [Vitest](https://vitest.dev/) for unit tests (aligns with Astro/Vite ecosystem)
- [happy-dom](https://github.com/capricorn86/happy-dom) or [jsdom](https://github.com/jsdom/jsdom) for DOM API mocking
- Optional: [Playwright](https://playwright.dev/) for E2E if image export flows need coverage

**First Tests to Add:**
1. `parseShareURL` in `src/scripts/showcase.ts` — covers all supported URL patterns
2. `getHighestPerGroup` and `getAllSelectedItems` — core showcase logic
3. `escapeHtml` — security-critical
4. Zod schemas in `src/content/config.ts` — validate one valid and one invalid league JSON
5. `scripts/verify-themes.mjs` — run against a temp directory with known-good and known-bad inputs

**CI Recommendation:**
- Add `npm test` to the build pipeline before deployment
- Keep `npm run verify:themes` as a required build step

---

*Testing analysis: 2026-08-01*
