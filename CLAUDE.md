# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static web application built with Astro for creating, sharing, and visualizing relic/mastery selections for OSRS and RS3 League events. Deployed on Netlify at relics.runetools.lol.

## Development

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:4321
npm run build      # Build for production
npm run preview    # Preview production build
```

## Architecture

### Astro Project Structure

```
leagues_relic_picker/
├── src/
│   ├── components/       # Reusable Astro components
│   │   ├── Navbar.astro
│   │   ├── Footer.astro
│   │   ├── DetailSidebar.astro
│   │   ├── ItemGrid.astro
│   │   ├── RelicItem.astro
│   │   ├── MasteryItem.astro
│   │   └── ExportButton.astro
│   ├── content/
│   │   ├── config.ts     # Content collection schema
│   │   └── leagues/      # League data files (JSON)
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PickerLayout.astro
│   ├── pages/
│   │   ├── index.astro   # Homepage
│   │   └── [...slug].astro  # Dynamic league pages
│   ├── scripts/
│   │   └── picker.ts     # Client-side interactivity
│   └── styles/
│       └── global.css    # Global styles
├── public/               # Static assets
│   ├── osrs/{1,2,4,5,6}/ # OSRS league assets (relics, logos)
│   ├── rs3/{1,2}/        # RS3 league assets
│   └── poster.png
├── astro.config.mjs
├── package.json
└── netlify.toml
```

### Content Collections

League data is stored in `src/content/leagues/` as JSON files with this schema:

```typescript
{
  game: 'osrs' | 'rs3',
  leagueNumber: number,
  name: string,
  pageType: 'relics' | 'masteries' | 'pacts',
  layout: 'columns' | 'rows',
  isRs3: boolean,
  backgroundColor: string,
  exportFilename: string,
  meta: { title, description, ogImage, ogImageAlt, url },
  theme: { titleColor, navItemColor, backgroundColor },
  items: Record<string, Item[]>
}
```

### URL Routing

| URL | Source |
|-----|--------|
| `/` | `src/pages/index.astro` |
| `/osrs/1/` | `[...slug].astro` → osrs-1-relics.json |
| `/osrs/5/` | `[...slug].astro` → osrs-5-relics.json |
| `/osrs/5/masteries/` | `[...slug].astro` → osrs-5-masteries.json |
| `/osrs/6/pacts/` | `[...slug].astro` → osrs-6-pacts.json |
| `/rs3/1/` | `[...slug].astro` → rs3-1-relics.json |

### URL State

Selections persist in URL parameters:
- `?selected=tier1-1,tier2-3` - Comma-separated element IDs
- `?title=My%20Build` - Custom title text

This enables sharing builds via URL.

### Adding a New League

1. Create a new JSON file in `src/content/leagues/` following the schema (e.g., `osrs-7-relics.json`)
2. Add assets to `public/{game}/{number}/` (relics images, logo.png)
3. Add theme variables to `public/{game}/{number}/variables.css` (for homepage theme selector)
4. Add navigation link in `src/pages/index.astro`

### Theme System

Homepage has a theme picker that loads different `variables.css` files from league directories in `/public`. User selection persists in localStorage under `selectedTheme`.

### Key Components

- **PickerLayout.astro** - Main layout for picker pages, includes navbar, export button, detail sidebar
- **ItemGrid.astro** - Renders items in columns (relics) or rows (masteries/pacts)
- **RelicItem.astro / MasteryItem.astro** - Individual item components with data attributes for client-side JS
- **picker.ts** - Client-side TypeScript for selection toggling, URL state, detail sidebar, and image export
