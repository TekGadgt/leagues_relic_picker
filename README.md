# Leagues Relic Picker

[![Netlify Status](https://api.netlify.com/api/v1/badges/3987763e-d974-4d7d-8c62-001a0eb162f5/deploy-status)](https://app.netlify.com/projects/league-relic-picker/deploys)

A comprehensive web application for creating, sharing, and visualizing relic and mastery selections for both Old School RuneScape (OSRS) and RuneScape 3 (RS3) League events.

🌐 **Live Site**: [league-relic-picker.netlify.app](https://league-relic-picker.netlify.app)

## 🎮 Supported Leagues

### OSRS Leagues
- **Twisted League** (2019) - The original league that started it all
- **Trailblazer League** (2020) - Choose your regions and relics
- **Trailblazer Reloaded** (2023) - The enhanced return of Trailblazer
- **Raging Echoes** (2024) - Features both Relics and Masteries systems

### RS3 Leagues
- **Catalyst League** (2024) - RS3's take on the league format

## ✨ Features

### 🎯 Core Functionality
- **Interactive Relic Selection**: Click to select/deselect relics with visual feedback
- **Custom Titles**: Edit page titles to personalize your build
- **URL Sharing**: Selections are saved in the URL for easy sharing
- **Image Export**: Generate PNG images of your relic selections
- **Responsive Design**: Works on desktop, tablet, and mobile devices (WIP)

### 🎨 User Experience
- **Hover Tooltips**: Detailed information about each relic's effects
- **Smart Positioning**: Tooltips automatically adjust to stay on screen
- **Visual Feedback**: Selected relics are highlighted, unselected ones are dimmed
- **Navigation**: Easy navigation between different league pages
- **Social Sharing**: Optimized meta tags for Discord, Twitter, and other platforms

### 🔧 Technical Features
- **Pure JavaScript**: No frameworks required, fast loading
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

# Serve locally (using any static file server)
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js
npx serve

# Option 3: PHP
php -S localhost:8000

# Then visit http://localhost:8000
```

## 📁 Project Structure

```
league_relic_picker/
├── index.html              # Homepage with league selection
├── styles.css              # Global styles and components
├── shared.js               # Shared JavaScript utilities
├── variables.css           # CSS custom properties
├── poster.png              # Social media preview image
├── osrs/                   # OSRS league data and pages
│   ├── 1/                  # Twisted League
│   ├── 2/                  # Trailblazer League
│   ├── 4/                  # Trailblazer Reloaded
│   └── 5/                  # Raging Echoes
│       ├── index.html      # Relics page
│       ├── masteries.html  # Masteries page
│       ├── relics.json     # Relic data
│       ├── masteries.json  # Mastery data
│       └── variables.css   # League-specific styling
└── rs3/                    # RS3 league data and pages
    └── 1/                  # Catalyst League
        ├── index.html      # Main page
        ├── relics.json     # Relic data
        └── variables.css   # League-specific styling
```

## 🛠️ Technical Implementation

### Technologies Used
- **HTML5**: Semantic markup and accessibility features
- **CSS3**: Modern layout, animations, and responsive design
- **Vanilla JavaScript**: ES6+ features, modular code organization
- **html2canvas**: Client-side image generation
- **JSON**: Data storage for relics and masteries

### Key Components

#### Relic Selection System
```javascript
// Example of the selection toggle system
function toggleElement(element, elements, titleSelector) {
  const isSelected = element.classList.toggle('selected');
  updateElementOpacity(element, isSelected);
  updateURLParams(elements, titleSelector);
}
```

#### URL State Management
Selections are automatically saved to the URL, enabling:
- Bookmarking specific builds
- Sharing builds via social media
- Browser history support

#### Dynamic Tooltip System
- Automatically positions tooltips based on screen edges
- Supports both relics and masteries
- Responsive sizing for mobile devices

## 🎨 Customization

### Adding a New League
1. Create the directory structure (e.g., `osrs/6/` or `rs3/2/`)
2. Add the JSON data file with relic information
3. Create the HTML page using the existing template
4. Add navigation links to the main index.html
5. Include league-specific CSS variables

### JSON Data Format
```json
{
  "relics": {
    "tier1": [
      {
        "id": "1",
        "src": "./path/to/image.png",
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

### CSS Theming
Each league can have custom colors and styling through `variables.css`:
```css
:root {
  --title-color: #d5281a;
  --nav-item-color: #802010;
  --background-color: #071022;
  --font-size-title: 5em;
}
```

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
- **Mobile browsers**: Optimized experience

## 🔧 Deployment

The project is automatically deployed to Netlify on every push to the main branch.

### Manual Deployment
```bash
# Build (if applicable)
# No build step required - static files only

# Deploy to any static hosting service
# - Netlify
# - Vercel
# - GitHub Pages
# - Any web server
```

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Jagex**: For creating the amazing League game modes
- **Community**: For feedback and suggestions
- **html2canvas**: For enabling client-side image generation
- **All contributors**: Thank you for your contributions!

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/TekGadgt/leagues_relic_picker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/TekGadgt/leagues_relic_picker/discussions)
- **Website**: [league-relic-picker.netlify.app](https://league-relic-picker.netlify.app)

---

Made with ❤️ for the RuneScape community

*Note: This project is not affiliated with Jagex or RuneScape. All game assets belong to their respective owners.*