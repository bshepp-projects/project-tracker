# Changelog

All notable changes to the Project Tracker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **🌙 Dark Mode Improvements**
  - Fixed popup windows (manage directories modal) not following dark/light mode theme switching
  - Added complete dark mode support to Claude Tracker with theme toggle functionality
  - Modal backgrounds and borders now properly use CSS variables for consistent theming

- **📐 Navigation Banner Consistency**
  - Standardized navigation banner dimensions, padding, and positioning across all tracker pages
  - Fixed Claude Tracker banner shape and location to match Project Tracker and Git Tracker
  - Ensured consistent nav-container styling with proper alignment and visual effects
  - All navigation bars now have identical responsive behavior and professional appearance

### Planned
- Enhanced project health dashboard  
- Real-time filesystem monitoring
- Mobile app version
- Advanced caching system
- Team collaboration features

## [1.5.0] - 2025-08-09

### Added
- **🔀 Git Repository Tracking & Management**
  - New Git Tracker interface (`git-tracker.html`) for comprehensive repository monitoring
  - Complete GitAnalyzer class in backend with detailed git repository analysis
  - `/api/git/repos` endpoint for repository data retrieval
  - Branch tracking: current branch, ahead/behind status, total branch count
  - Working tree analysis: clean/dirty status, uncommitted changes, untracked files
  - Last commit information: hash, message, author, relative timestamps
  - GitHub repository detection and integration
  - GitHub Actions workflow status monitoring via GitHub CLI integration
  - .gitignore presence detection for repository health assessment

- **🌐 Multi-Tab Navigation System**
  - Unified navigation bar across all interfaces
  - Three main tabs: Project Tracker, Claude Tracker, Git Tracker  
  - Consistent theme and styling across all interfaces
  - Seamless switching between different project management views

- **⚡ Enhanced Repository Operations**
  - Quick-copy git commands (fetch, pull, push) with clipboard integration
  - GitHub URL copying for easy repository access
  - Smart command generation based on repository status
  - Platform-specific folder opening commands
  - Repository status badges with visual indicators (ahead, behind, clean, dirty, etc.)

- **🎨 Improved UI/UX & Accessibility**
  - Enhanced dark mode text contrast for better readability
  - Separate CSS variables for light background text (`--text-light-bg`)
  - Improved contrast ratios across all interface elements
  - Better visual hierarchy with status badges and color coding
  - Responsive design improvements for repository cards

### Changed
- **Backend Architecture Enhancement**
  - Enhanced server.js with GitAnalyzer class for comprehensive repository analysis
  - Improved error handling for git operations and missing directories
  - Better timeout management for git commands (10s timeout)
  - GitHub CLI integration for Actions workflow status

- **CSS Variable System Improvements**
  - Added dedicated variables for light background text contrast
  - Improved theme consistency across all three interfaces
  - Better color accessibility in both light and dark modes

### Fixed
- **🎨 Text Contrast & Accessibility**
  - Fixed dark mode text being too dark to read in previous version
  - Resolved light background text being too light in dark mode
  - Improved readability of info boxes and card content
  - Better contrast ratios meeting accessibility standards

- **🔧 Git Integration Reliability**
  - Proper error handling for repositories without remotes
  - Graceful handling of detached HEAD states
  - Better parsing of git status output for accurate ahead/behind counts
  - Improved detection of GitHub vs. other git hosting services

### Technical
- Added comprehensive GitAnalyzer class with methods for:
  - Branch status analysis with ahead/behind counting
  - Working tree status detection
  - GitHub Actions integration via `gh run list`
  - Multi-platform git command execution
- Enhanced API architecture with new `/api/git/repos` endpoint
- Improved CSS architecture with accessibility-focused variables
- Better error handling and timeout management for external commands

## [1.4.0] - 2025-08-07

### Added
- **🌙 Dark Mode Implementation**
  - Complete dark/light theme system with CSS variables
  - Smooth transitions between themes (0.3s ease)
  - Persistent theme preferences using localStorage
  - Eye-friendly dark color palette (deep blues and grays)
  - Dynamic theme toggle button in navigation bar with animated icons
  - Theme-aware notifications and UI components

- **⚡ Enhanced Directory Management**
  - Non-disruptive project addition (no automatic refresh interruptions)
  - Batched operations workflow with "Finish & Refresh Projects" button
  - Improved modal footer with clear action buttons
  - Better user feedback and workflow guidance
  - Informational tips for optimal usage patterns

- **🎨 UI/UX Improvements**
  - Enhanced navigation bar styling with rounded corners and improved spacing
  - Better visual separation between banner and main content
  - Constrained banner width to match main container
  - Professional modal design with footer actions
  - Improved button styling and hover effects

### Changed
- **Directory Scanning Behavior**: Now scans only individual project directories instead of all subdirectories
- **Project Addition Workflow**: Removed automatic refresh triggers during bulk operations
- **Modal Interface**: Added finish/cancel buttons for better control over refresh timing
- **Theme Integration**: All UI components now use CSS variables for consistent theming
- **Navigation Layout**: Theme toggle positioned with automatic spacing in nav bar

### Fixed
- **Directory Management**: Fixed issue where removing one project would remove entire parent directories
- **Bulk Operations**: Eliminated jarring refresh interruptions during multiple project additions
- **Theme Persistence**: Ensures no white flash when loading dark mode
- **UI Consistency**: All form inputs and components now respect theme settings

### Technical
- Implemented comprehensive CSS variable system for maintainable theming
- Added localStorage integration for cross-session preference persistence  
- Enhanced notification system with theme-aware colors
- Improved JavaScript architecture for theme management
- Added transition animations for smooth theme switching

## [1.3.0] - 2025-08-05

### Added
- **🚀 Backend API Service**
  - Node.js Express server for comprehensive filesystem scanning
  - RESTful API endpoints: `/api/projects`, `/api/health`, `/api/config`
  - Automatic project discovery on page load and refresh
  - Configurable scan directories in backend
  - Fallback system for offline backend scenarios
  - CORS support for secure frontend-backend communication

- **⚡ Enhanced Project Analysis**
  - Real-time filesystem analysis with recursive directory traversal
  - Intelligent depth limiting to prevent infinite loops
  - Advanced file type detection (15+ programming languages)
  - Smart project categorization based on file patterns
  - Production/Development status detection

- **🛠️ Developer Experience**
  - Setup script (`setup.sh`) for easy installation
  - Updated documentation with backend setup instructions
  - Comprehensive error handling and user feedback
  - Toast notifications for API status updates

### Changed
- Frontend now uses backend API instead of browser-based File System Access API
- Projects automatically refresh from filesystem on page load
- Improved performance with server-side project analysis
- Enhanced reliability with fallback to cached projects

### Fixed
- Eliminated browser security limitations with File System Access API
- Improved cross-platform compatibility for project scanning
- Better error handling for inaccessible directories

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

*Last updated: August 9, 2025*