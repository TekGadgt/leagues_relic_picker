# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static web application for creating, sharing, and visualizing relic/mastery selections for OSRS and RS3 League events. Deployed on Netlify at relics.runetools.lol.

## Development

No build step required - serve static files directly:

```bash
python -m http.server 8000
# or
npx serve
```

Then visit http://localhost:8000

## Architecture

### Core Pattern

Each league page follows the same pattern:
1. HTML page loads league-specific `variables.css` for theming
2. Page includes global `styles.css` and `shared.js`
3. JSON data file (`relics.json` or `masteries.json`) defines items for that league
4. JavaScript dynamically renders items from JSON and handles selection state

### Key Files

- `shared.js` - Core utilities: URL state management (`updateURLParams`, `setInitialSelections`), selection toggling (`toggleElement`), and tooltip positioning (`setupTooltips`)
- `styles.css` - All component styles including `.relic`, `.mastery`, `.tooltip`, navbar, footer
- `variables.css` (root level) - Default CSS custom properties
- `{game}/{league}/variables.css` - League-specific theme overrides

### URL State

Selections persist in URL parameters:
- `?selected=tier1-1,tier2-3` - Comma-separated element IDs
- `?title=My%20Build` - Custom title text

This enables sharing builds via URL.

### JSON Data Format

```json
{
  "relics": {
    "tier1": [
      {
        "id": "1",
        "src": "../assets/5/relics/Power_Miner.png",
        "relicLabel": "Power Miner",
        "toolTipItems": ["Effect 1", "Effect 2"]
      }
    ]
  }
}
```

Element IDs are constructed as `{tier}-{id}` (e.g., `tier1-1`).

### Adding a New League

1. Create directory structure: `{game}/{number}/` (e.g., `osrs/6/`)
2. Add `index.html` using existing league page as template
3. Add `relics.json` (and `masteries.json` if applicable)
4. Add `variables.css` with league theme colors
5. Add assets to `{game}/assets/{number}/`
6. Add navigation link in root `index.html`

### Theme System

Homepage has a theme picker that loads different `variables.css` files from league directories. User selection persists in localStorage under `selectedTheme`.
