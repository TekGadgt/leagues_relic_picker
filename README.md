# Leagues Relic Picker

[![Netlify Status](https://api.netlify.com/api/v1/badges/3987763e-d974-4d7d-8c62-001a0eb162f5/deploy-status)](https://app.netlify.com/projects/league-relic-picker/deploys)

A comprehensive web application for creating, sharing, and visualizing relic and mastery selections for both Old School RuneScape (OSRS) and RuneScape 3 (RS3) League events.

🌐 **Live Site**: [relics.runetools.lol](https://relics.runetools.lol/)

## 🎮 Supported Leagues

### OSRS Leagues
- **Twisted League** (2019) - The original league that started it all
- **Trailblazer League** (2020) - Choose your regions and relics
- **Trailblazer Reloaded** (2023) - The enhanced return of Trailblazer
- **Raging Echoes** (2024) - Features both Relics and Masteries systems
- **Demonic Pacts** (2026) - Not many details known yet, possibly pacts only, possibly relics & pacts, will update accordingly

### RS3 Leagues
- **Catalyst League** (2025) - RS3's take on the league format
- **Equilibrium League** (2026) - RS3's second league, themed around Order, Balance, and Chaos

## ✨ Features

### 🎯 Core Functionality
- **Interactive Relic Selection**: Click to select/deselect relics with visual feedback
- **Custom Titles**: Edit page titles to personalize your build
- **URL Sharing**: Selections are saved in the URL for easy sharing
- **Image Export**: Generate PNG images of your relic selections
- **Responsive Design**: Works on desktop, tablet, and mobile devices (WIP)

### 🎨 User Experience
- **Right Click Sidebar**: Detailed information about each relic's effects
- **Visual Feedback**: Selected relics are highlighted, unselected ones are dimmed
- **Navigation**: Easy navigation between different league pages

### 🔧 Technical Features
- **AstroJS**: Minimal Framework usage, fast loading
- **Client-side Rendering**: Dynamic content generation from JSON data
- **Semantic HTML**: Accessible and SEO-friendly markup
- **CSS Grid/Flexbox**: Modern layout techniques for perfect alignment
- **Local Storage Support**: Remembers your preferences

## 🚀 Getting Started

### Quick Start
1. Visit [league-relic-picker.netlify.app](https://league-relic-picker.netlify.app)
2. Choose your league from the homepage
3. Click relics to select them
4. Edit the title by clicking on it
5. Export or share your selection!

### Local Development
```bash
# Clone the repository
git clone https://github.com/TekGadgt/leagues_relic_picker.git

# Navigate to the project directory
cd leagues_relic_picker

#Install Dependencies
npm install

# Serve locally (using any static file server)
npm run dev

# Then visit http://localhost:4321
```

## 🛠️ Technical Implementation

### Technologies Used
- **HTML5**: Semantic markup and accessibility features
- **CSS3**: Modern layout, animations, and responsive design
- **Vanilla JavaScript**: ES6+ features, modular code organization
- **html2canvas**: Client-side image generation
- **JSON**: Data storage for relics and masteries
- **AstroJS**: Astro Framework

### Key Components

#### URL State Management
Selections are automatically saved to the URL, enabling:
- Bookmarking specific builds
- Sharing builds via social media
- Browser history support

#### Right Click Sidebar
- Right click any relic/mastery/pact to display a sidebar with details about it
- Supports relics, masteries, and pacts

## 🎨 Customization

### Adding a New League

1. **Create the data file** in `src/content/leagues/`, named `{game}-{number}-{pageType}.json`
   (e.g. `osrs-7-relics.json`). It must satisfy the schema in `src/content/config.ts`.
2. **Add the assets** to `public/{game}/{number}/` — `logo.png` plus a `relics/` directory
   of item images.
3. **Add the theme** — a `[data-theme="{game}/{number}"]` block in `src/styles/themes.css`.
   See [CSS Theming](#css-theming) below.
4. **Add the homepage link** in `src/pages/index.astro`.

Routing is automatic: `src/pages/[...slug].astro` generates a page per data file. A file with
`pageType: "relics"` becomes `/{game}/{number}/`; anything else becomes
`/{game}/{number}/{pageType}/`. So `osrs-7-relics.json` serves `/osrs/7/`, and
`osrs-7-masteries.json` serves `/osrs/7/masteries/`. One league can have several pages, and
they share a single theme.

Run `npm run build` when you're done — it type-checks the data against the schema and verifies
the theme wiring, so a missing theme block or a malformed data file fails the build rather than
shipping.

### JSON Data Format

League data lives in `src/content/leagues/*.json` as an [Astro content
collection](https://docs.astro.build/en/guides/content-collections/), validated at build time by
the Zod schema in `src/content/config.ts`.

```json
{
  "game": "osrs",
  "leagueNumber": 7,
  "name": "Example League",
  "pageType": "relics",
  "layout": "columns",
  "exportFilename": "relics.png",
  "meta": {
    "title": "Example League Relic Picker",
    "description": "Set a title, pick your relics, screenshot, and share",
    "ogImage": "https://relics.runetools.lol/osrs/7/poster_relics.png",
    "ogImageAlt": "A Selection of Relics for OSRS Example League.",
    "url": "https://relics.runetools.lol/osrs/7/"
  },
  "items": {
    "tier1": [
      {
        "id": "1",
        "src": "/osrs/7/relics/Relic_Name.png",
        "relicLabel": "Relic Name",
        "toolTipItems": [
          "Effect description line 1",
          "Effect description line 2"
        ]
      }
    ]
  }
}
```

Notes:

- `layout` is `"columns"` (relics), `"rows"` (masteries/pacts), or `"graph"` (a node/edge tree,
  which additionally requires a `graph` object — see `osrs-6-pacts.json`).
- `src` paths are absolute from `public/`, not relative.
- Colors do **not** live here. They're in `src/styles/themes.css` — see below.

### CSS Theming

Every league color lives in exactly one file: `src/styles/themes.css`. Each league is one block
setting four custom properties:

```css
[data-theme="osrs/7"] {
  --title-color: #4fc3f7;             /* headings and accents */
  --nav-item-color: #2b7fa8;          /* nav labels, separators */
  --header-background-color: #0a1a24; /* navbar background */
  --background-color: #050d12;        /* page and export background */
}
```

A page picks its theme with a `data-theme` attribute, and there are three ways that happens:

- **Picker pages** get it server-rendered onto `<html>`, so they need no JavaScript at all and
  theme correctly even with JS disabled.
- **The homepage and showcase** set it from `localStorage.selectedTheme` in a synchronous inline
  script in `<head>`. Running before first paint is what makes theme switching flicker-free —
  if you touch that script, keep it inline, synchronous, and unwrapped by any event listener.
- **Showcase rows** each set their own, which is how one page displays several leagues at once.
  This works because custom properties inherit, so any element can carry a theme.

Selectors are deliberately element-level (`[data-theme="…"]`, never `:root[data-theme="…"]`) —
the `:root` prefix would restrict theming to `<html>` and break the showcase. The default is
`rs3/1`, written as a zero-specificity `:where(:root)` sharing that block, so an explicit theme
always wins without needing `!important`.

`npm run verify:themes` enforces all of this — it fails if a color is duplicated outside
`themes.css`, if a league has no theme block, or if the stylesheet stops reaching the browser.
It runs as part of `npm run build`, so drift breaks the build instead of shipping silently.

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Bug Reports
- Use the GitHub issue tracker
- Include steps to reproduce
- Mention browser and device information

### Feature Requests
- Check existing issues first
- Provide detailed use cases
- Consider implementation complexity

### Pull Requests
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test across different browsers
5. Submit a pull request

### Development Guidelines
- Follow existing code style
- Test on mobile devices
- Ensure accessibility compliance
- Update documentation as needed

## 📱 Browser Support

- **Chrome/Edge**: Full support
- **Firefox**: Full support  
- **Safari**: Full support

## 🔧 Deployment

The project is automatically deployed to Netlify on every push to the main branch.

### Manual Deployment
```bash
# Build
npm run build

# Deploy to any static hosting service
# - Netlify
# - Vercel
# - GitHub Pages
# - Any web server
```

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Jagex**: For creating the amazing Leagues game modes
- **Community**: For feedback and suggestions
- **html2canvas**: For enabling client-side image generation
- **All contributors**: Thank you for your contributions!

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/TekGadgt/leagues_relic_picker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/TekGadgt/leagues_relic_picker/discussions)
- **Website**: [relics.runetools.lol](https://relics.runetools.lol)

---

Made with ❤️ for the RuneScape community

*Note: This project is not affiliated with Jagex or RuneScape. All game assets belong to their respective owners.*
