# Changelog

All notable changes to the Project Tracker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Git integration with commit history
- Project health dashboard
- Dark mode toggle
- Backend API development
- Mobile app version
- Manual add/remove project functionality

## [1.2.0] - 2025-08-04

### Added
- **🔍 Dynamic Project Scanning**
  - New "🔍 Scan Folders" button for real-time project discovery
  - Browser-based folder selection using File System Access API
  - Multi-project scanning from parent directories
  - Hybrid system combining hardcoded projects with user-scanned projects

- **🤖 Intelligent Auto-Detection**
  - Automatic CLAUDE.md detection and marking
  - Virtual environment detection (venv/, .venv/, requirements.txt)
  - README file detection (README.md, readme.txt, etc.)
  - Technology stack analysis from file extensions
  - Smart project categorization based on structure and naming

- **📊 Advanced Project Analysis**
  - Technology mapping for 15+ languages (Python, JavaScript, TypeScript, Java, C++, Rust, Go, etc.)
  - Framework detection (Node.js, Docker, Python packages)
  - Category classification (Web Application, AI/ML Project, Backend Service, Mobile App)
  - Status detection (Production vs Development based on Docker files, test files)
  - Automatic tag generation for enhanced filtering

- **🎨 Enhanced User Interface**
  - Custom favicon with folder and project dots design
  - Visual scanning feedback with button state changes
  - Success notification system with toast messages
  - Updated subtitle encouraging dynamic project discovery

### Improved
- **Enhanced Folder Opening**
  - Fixed folder opening to copy system commands instead of opening browser tabs
  - Better platform detection (Windows explorer, macOS open, Linux xdg-open)
  - Improved user feedback with clipboard integration

- **Project Data Management**
  - Seamless merging of hardcoded and scanned projects
  - Non-destructive scanning that preserves existing projects
  - Real-time project list updates without page refresh

### Technical
- Implemented browser File System Access API integration
- Added comprehensive file analysis engine
- Created intelligent project categorization algorithms
- Enhanced notification system with styled toast messages
- Improved data persistence and project state management

## [1.1.0] - 2025-08-04

### Added
- **CLAUDE.md Detection & Integration**
  - New `hasClaude` field in project data structure
  - Visual 🤖 indicator on project cards showing CLAUDE.md presence
  - New "🤖 Claude" action button that copies `claude --continue` command to clipboard
  - Conditional rendering - Claude button only appears for projects with CLAUDE.md

- **Virtual Environment Management**
  - New `hasVenv` field in project data structure
  - Visual 🐍 indicator showing virtual environment presence
  - New "🐍 Activate" action button that copies venv activation commands to clipboard
  - Platform-specific command generation (Linux/Mac vs Windows)

- **Enhanced Project Cards**
  - Expanded info grid from 2 to 3 columns for better information display
  - Added CLAUDE.md and Virtual Env status indicators
  - New action buttons with distinct color coding and hover effects
  - Smart conditional rendering based on project capabilities

### Improved
- **Enhanced Folder Opening**
  - Improved `openFolder()` function with better platform detection
  - Fallback to copying system-specific commands (`explorer`, `open`, `xdg-open`) 
  - Better error handling and user feedback with visual button states
  - Command copying as backup when direct folder opening fails

- **User Experience**
  - Enhanced button feedback with loading states and confirmation messages
  - Smooth animations for button state changes
  - Graceful handling of projects without hasClaude/hasVenv data (shows "❓ Unknown")
  - Color-coded action buttons for better visual organization

### Technical
- Added proper handling for undefined hasClaude and hasVenv fields
- Improved CSS grid layout for project information display
- Enhanced JavaScript functions with better error handling
- Added clipboard integration for command copying functionality

### Project Data Updates
- Updated key projects with hasClaude and hasVenv status:
  - 2014_CS102 Geometry Engine: Claude ✅, Venv ✅
  - nohCAPTCHA Authentication: Claude ✅, Venv ✅
  - Q Studio Backend: Claude ✅, Venv ✅
  - Fundo-matic: Claude ✅, Venv ✅
  - Data Retrieval System: Claude ❌, Venv ✅
  - Thing Counter: Claude ❌, Venv ✅

## [1.0.0] - 2025-08-04

### Added
- **Initial Release** 🎉
- Comprehensive project dashboard with visual cards
- Real-time search functionality across project names, descriptions, and technologies
- Category-based filtering system (All, Production, Development, AI/ML, Web)
- Project statistics dashboard showing totals and activity levels
- Interactive project cards with hover effects and animations
- One-click folder opening functionality
- README file viewing capability
- Copy-to-clipboard for project paths
- Responsive design supporting desktop and mobile devices
- Keyboard shortcuts (Ctrl+R for refresh)
- Modern, clean UI with gradient backgrounds and smooth transitions

### Project Database
- **51+ projects cataloged** across multiple categories:
  - 8 Utility Projects (data retrieval, analysis, automation)
  - 6 Consciousness/AI Research Projects
  - 4 Science Projects (physics, academic research)
  - 3 Experimental Projects (quantum AI, mobile apps)
  - 3 Art Projects (AI haiku, generative art)
  - 2 Gaming Projects (Minecraft AI, game research)
  - Multiple web properties and infrastructure tools

### Technical Features
- Single-file HTML application (no server required)
- Embedded CSS and JavaScript for portability
- Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- Fast loading with no external dependencies
- Local-only operation (privacy-focused)
- Error handling for file system operations

### Project Categories Supported
- **Production Ready**: 15 projects with live deployments
- **Development**: 25 projects in active development
- **AI/ML Projects**: 18 machine learning and AI projects
- **Quantum Computing**: 8 projects with quantum hardware integration
- **Web Applications**: 12 web projects from simple to complex

### User Experience
- Intuitive search with instant results
- Filter buttons with dynamic statistics updates
- Project cards showing comprehensive information:
  - Project name and description
  - Full file system path
  - Technology stack indicators
  - Status badges (Production/Development/Research)
  - README availability indicators
  - Last modified timestamps
- Smooth animations and transitions
- Accessibility considerations in design

### Documentation
- Comprehensive README with setup instructions
- Future improvements roadmap
- Version tracking with changelog
- Code organization and customization guide

---

## Version History Notes

### Release Naming Convention
- **Major versions (x.0.0)**: Significant feature additions or architectural changes
- **Minor versions (x.y.0)**: New features, enhancements, or substantial improvements
- **Patch versions (x.y.z)**: Bug fixes, minor improvements, or documentation updates

### Contribution Guidelines
All changes should be documented in this changelog following the format:
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

### Future Release Planning
- **v1.1.0**: Enhanced search and filtering capabilities
- **v1.2.0**: Git integration and project health indicators
- **v2.0.0**: Backend API and dynamic project scanning
- **v2.1.0**: Collaboration features and cloud sync
- **v3.0.0**: Mobile app and advanced analytics

---

*Last updated: August 4, 2025*