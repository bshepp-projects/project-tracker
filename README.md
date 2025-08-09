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

### Current Features (v1.4)
- **📊 Project Dashboard**: Visual overview of all projects with statistics
- **🔍 Dynamic Project Scanning**: Real-time project discovery from your filesystem
- **🤖 Intelligent Auto-Detection**: Automatic detection of CLAUDE.md, virtual environments, and README files
- **📊 Smart Project Analysis**: Technology stack detection and categorization from file structures
- **🏷️ Advanced Filtering**: Filter by project type (Production, Development, AI/ML, Web)
- **📁 Enhanced Folder Access**: Smart folder opening with platform-specific commands
- **📋 Path Management**: Copy project paths to clipboard
- **🌙 Dark/Light Mode**: Eye-friendly themes with persistent preferences and smooth transitions
- **⚡ Batched Operations**: Non-disruptive project management with "Finish & Refresh" workflow
- **🎨 Professional UI**: Rounded navigation bar, improved spacing, and polished interface
- **📱 Responsive Design**: Works on desktop and mobile devices with theme support
- **⌨️ Keyboard Shortcuts**: Ctrl+R to refresh, efficient navigation
- **🎨 Modern Theming**: Complete CSS variable system for consistent dark/light mode experience

### Project Information Displayed
- Project name and description
- Full file system path
- Technology stack and file types
- Project status (Production/Development/Research)
- Last modified information
- README availability
- **🤖 CLAUDE.md presence** - Shows if project has Claude integration
- **🐍 Virtual environment status** - Shows if project has Python venv
- **💻 Local Claude Code installation** - Accurately detects if project has Claude Code CLI installed locally in venv
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
- Node.js 16+ (for backend API)
- Local file system access

### Installation & Setup

#### Option 1: With Backend API (Recommended)

**Quick Setup:**
```bash
# Clone the repository
git clone https://github.com/yourusername/project-tracker.git
cd project-tracker

# Run the setup script (macOS/Linux)
./setup.sh

# Start the backend server
cd server && npm start
# Server will run on http://localhost:3001

# Open the frontend in your browser
open project-tracker.html  # macOS/Linux
start project-tracker.html # Windows
```

**Manual Setup:**
```bash
# Clone the repository
git clone https://github.com/yourusername/project-tracker.git
cd project-tracker

# Install backend dependencies
cd server
npm install

# Start the backend server
npm start
# Server will run on http://localhost:3001

# In a new terminal, open the frontend
cd ..
# On macOS/Linux:
open project-tracker.html
# On Windows:
start project-tracker.html
# Or simply double-click the file
```

#### Option 2: Standalone Frontend Only
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

Note: The standalone frontend will use fallback project data when the backend is not available.

### Alternative: Download ZIP
1. Download the ZIP file from the GitHub releases
2. Extract to your desired location
3. Open `project-tracker.html` in your web browser
4. Start exploring your projects!

### Usage
1. **Automatic Discovery**: Projects are automatically scanned from your filesystem on page load
2. **Theme Selection**: Click the 🌙/☀️ button in the navigation bar to toggle between light and dark modes
3. **Browse Projects**: Scroll through the grid of project cards with real-time information
4. **Search**: Use the search bar to find specific projects by name or technology
5. **Filter**: Click category buttons to filter by project type
6. **Access Projects**: 
   - Click "📁 Open" to open the project directory in file explorer
   - Click "📄 README" to view project documentation
   - Click "🤖 Claude" to copy `claude --continue` command (for projects with CLAUDE.md)
   - Click "💻 Local Claude" to copy local venv Claude activation command
   - Click "🐍 Activate" to copy virtual environment activation commands
   - Click "📋 Copy" to copy the full path to clipboard
   - Click "🚫 Remove" to remove the project from tracking
7. **Manage Projects**: Click "⚙️ Manage Directories" to add/remove individual project directories
8. **Refresh**: Click "🔄 Refresh Projects" or press Ctrl+R to rescan and update the view

### Developer Workflow Integration
- **🔍 Individual Project Management**: Add specific project directories rather than parent folders
- **🤖 CLAUDE.md Projects**: Projects with 🤖 indicator have Claude integration ready
- **🐍 Python Projects**: Projects with 🐍 indicator have virtual environments configured
- **💻 Local Claude Projects**: Projects with 💻 indicator have Claude Code installed locally in their venv
- **📊 Smart Analysis**: Automatic detection of technologies, frameworks, and project types
- **⚡ Batched Operations**: Add/remove multiple projects without interrupting refreshes
- **🌙 Eye-friendly Development**: Dark mode for extended coding sessions
- **Smart Commands**: Action buttons copy appropriate commands to clipboard for immediate use
- **Platform Detection**: Commands are automatically tailored for Windows, macOS, or Linux

### Dynamic Project Scanning
- **Real-time Discovery**: Click "🔍 Scan Folders" to analyze your project directories
- **Intelligent Detection**: Automatically identifies:
  - Programming languages and frameworks
  - Virtual environments and dependencies
  - Documentation and configuration files
  - Project types and categories
- **Seamless Integration**: Scanned projects appear immediately with full feature detection
- **Non-destructive**: Scanning adds to existing projects without data loss

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
├── server/                      # Backend API service
│   ├── server.js               # Express server with project analysis
│   ├── package.json            # Backend dependencies
│   └── node_modules/           # Backend node modules
├── README.md                     # This file
├── FUTURE_IMPROVEMENTS.md        # Roadmap and planned features
├── CHANGELOG.md                  # Version history
└── favicon.svg                   # Custom favicon
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