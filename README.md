# Project Tracker

A comprehensive local web-based project management and discovery tool designed to help developers track, organize, and navigate their numerous projects across multiple directories.

## 🎯 Problem Statement

As developers, we often accumulate dozens or hundreds of projects across various directories, making it difficult to:
- Remember what projects exist and where they're located
- Quickly access projects that haven't been touched in a while
- Get an overview of project technologies and status
- Navigate between different types of projects efficiently

Project Tracker solves these problems by providing a centralized, visual interface to all your projects.

## ✨ Features

### Current Features (v1.1)
- **📊 Project Dashboard**: Visual overview of all projects with statistics
- **🔍 Real-time Search**: Instant search across project names, descriptions, and technologies
- **🏷️ Category Filtering**: Filter by project type (Production, Development, AI/ML, Web)
- **📁 Enhanced Folder Access**: Smart folder opening with platform-specific commands
- **📋 Path Management**: Copy project paths to clipboard
- **🤖 CLAUDE.md Integration**: Visual indicators and one-click Claude launching for projects with CLAUDE.md
- **🐍 Virtual Environment Support**: Detect and activate Python virtual environments
- **📱 Responsive Design**: Works on desktop and mobile devices
- **⌨️ Keyboard Shortcuts**: Ctrl+R to refresh, efficient navigation
- **🎨 Modern UI**: Clean, intuitive interface with hover effects and animations

### Project Information Displayed
- Project name and description
- Full file system path
- Technology stack and file types
- Project status (Production/Development/Research)
- Last modified information
- README availability
- **🤖 CLAUDE.md presence** - Shows if project has Claude integration
- **🐍 Virtual environment status** - Shows if project has Python venv
- Project category and type

### Supported Project Categories
- **Utility Projects**: Data tools, analysis systems, automation
- **AI/ML Projects**: Machine learning, neural networks, AI research
- **Web Applications**: Frontend, backend, full-stack projects
- **Science Projects**: Research tools, simulations, academic work
- **Art Projects**: Creative coding, generative art
- **Gaming Projects**: Game development, AI gaming
- **Infrastructure**: DevOps, cloud tools, deployment scripts

## 🚀 Quick Start

### Requirements
- Any modern web browser (Chrome, Firefox, Safari, Edge)
- Local file system access
- No server installation required!

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/project-tracker.git
cd project-tracker

# Open the tracker in your browser
# On macOS/Linux:
open project-tracker.html
# On Windows:
start project-tracker.html
# Or simply double-click the file
```

### Alternative: Download ZIP
1. Download the ZIP file from the GitHub releases
2. Extract to your desired location
3. Open `project-tracker.html` in your web browser
4. Start exploring your projects!

### Usage
1. **Browse Projects**: Scroll through the grid of project cards
2. **Search**: Use the search bar to find specific projects by name or technology
3. **Filter**: Click category buttons to filter by project type
4. **Access Projects**: 
   - Click "📁 Open" to open the project directory in file explorer
   - Click "📄 README" to view project documentation
   - Click "🤖 Claude" to copy `claude --continue` command (for projects with CLAUDE.md)
   - Click "🐍 Activate" to copy virtual environment activation commands
   - Click "📋 Copy" to copy the full path to clipboard
5. **Refresh**: Click "🔄 Refresh Projects" or press Ctrl+R to update the view

### Developer Workflow Integration
- **CLAUDE.md Projects**: Projects with 🤖 indicator have Claude integration ready
- **Python Projects**: Projects with 🐍 indicator have virtual environments configured
- **Smart Commands**: Action buttons copy appropriate commands to clipboard for immediate use
- **Platform Detection**: Commands are automatically tailored for Windows, macOS, or Linux

## 📈 Project Statistics

The current installation tracks **51+ projects** across categories:
- **15 Production-ready projects** with live deployments
- **18 AI/ML projects** covering various machine learning domains
- **8 Quantum computing projects** with real hardware integration
- **12 Web applications** ranging from simple sites to complex platforms

## 🛠️ Project Structure

```
project-tracker/
├── project-tracker.html          # Main application file
├── README.md                     # This file
├── FUTURE_IMPROVEMENTS.md        # Roadmap and planned features
├── CHANGELOG.md                  # Version history
└── venv/                        # Virtual environment (if needed)
```

## 🔧 Customization

### Adding New Projects
Currently, projects are defined in the JavaScript `projectsData` array within the HTML file. To add new projects:

1. Open `project-tracker.html` in a text editor
2. Locate the `projectsData` array
3. Add a new project object with the following structure:

```javascript
{
    name: "project-name",
    path: "/full/path/to/project",
    description: "Brief description of the project",
    lastModified: "Recently Active", // or "Active" or "Dormant"
    files: "Technology stack (Python, JavaScript, etc.)",
    hasReadme: true, // or false
    type: "Category/Type"
}
```

### Styling Customization
The CSS is embedded in the HTML file and can be modified to change:
- Color schemes and themes
- Layout and spacing
- Card designs and animations
- Typography and fonts

## 🎨 Features Showcase

### Dashboard Overview
- Clean, card-based layout with project thumbnails
- Real-time statistics showing total projects and activity levels
- Responsive grid that adapts to screen size

### Advanced Search
- Search across project names, descriptions, and technology stacks
- Instant results with highlight matching
- No backend required - all processing happens in the browser

### Smart Filtering
- Pre-defined category filters for common project types
- Dynamic statistics that update based on active filters
- Easy one-click filter application and removal

## 🚀 Future Development

This project has an extensive roadmap! See [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md) for detailed plans including:

- **Dynamic Project Scanning**: Automatic filesystem monitoring
- **Git Integration**: Show commit history, branch status, and repository health
- **Project Analytics**: Time tracking, technology trends, and insights
- **Collaboration Features**: Team sharing and multi-user support
- **Advanced UI**: Dark mode, customizable layouts, and mobile app

## 🤝 Contributing

Contributions are welcome! Here's how to get involved:

1. **Report Issues**: Found a bug or have a feature request? Open an issue
2. **Suggest Improvements**: Review the roadmap and suggest new features
3. **Submit Code**: Fork the repository and submit pull requests
4. **Documentation**: Help improve documentation and examples

### Development Setup
1. Clone the repository
2. Open `project-tracker.html` in your browser
3. Make changes and test locally
4. Submit a pull request with your improvements

## 📊 Performance

- **Fast Loading**: Loads instantly with no server dependencies
- **Efficient Search**: Real-time search across 50+ projects with no lag
- **Responsive**: Smooth animations and interactions on all devices
- **Lightweight**: Single HTML file under 50KB

## 🔒 Privacy & Security

- **100% Local**: All data stays on your machine
- **No Tracking**: No analytics, cookies, or external requests
- **Open Source**: Full transparency in code and functionality
- **Secure**: No server vulnerabilities or data transmission risks

## 📱 Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 📝 License

This project is open source. Feel free to use, modify, and distribute as needed.

## 🙏 Acknowledgments

- Built to solve a real developer pain point
- Inspired by the need for better project organization
- Designed with simplicity and efficiency in mind

---

**Made with ❤️ for developers who have too many projects to keep track of!**

For questions, suggestions, or contributions, please open an issue or submit a pull request.