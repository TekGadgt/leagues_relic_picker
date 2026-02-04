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
- **TBD** (2026) - RS3's Second League

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
TODO: Update steps, it's changed a fair bit since migrating to Astro

### JSON Data Format
TODO: This is still mostly accurate, but where it's stored has changed.
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
TODO: Update this, theming works better now but has gotten more convoluted as a result.

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
