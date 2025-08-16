# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Tracker is a local tool to find and organize your projects. It has:

- **Frontend**: Single-page HTML application (`project-tracker.html`) with embedded CSS/JavaScript
- **Backend**: Node.js Express server (`server/server.js`) that provides API endpoints for filesystem scanning
- **Simple design**: Frontend HTML file + optional Node.js backend for scanning

## Core Architecture

### Frontend (`project-tracker.html`)
- Single HTML file containing all UI, CSS, and JavaScript
- Communicates with backend API at `http://localhost:3001`
- Falls back to hardcoded project data when backend unavailable
- Uses modern JavaScript features (ES6+) and responsive CSS

### Backend (`server/server.js`)
- Express.js server with CORS enabled for frontend communication
- Two main analysis classes: `ProjectAnalyzer` and `ClaudeAnalyzer`
- Configurable directory scanning with persistence in `directories.json`
- RESTful API endpoints for project discovery and configuration

## Development Commands

### Setup and Installation
```bash
# Quick setup (recommended)
./setup.sh

# Manual setup
cd server && npm install

# Start backend server
cd server && npm start
# Server runs on http://localhost:3001

# Development mode with auto-restart
cd server && npm run dev
```

### Frontend Development
```bash
# Open frontend (choose one method)
open project-tracker.html          # macOS
start project-tracker.html         # Windows
xdg-open project-tracker.html      # Linux

# Or serve locally with any HTTP server
python -m http.server 8000
# Then visit http://localhost:8000/project-tracker.html
```

### Testing and Validation
```bash
# Test backend health
curl http://localhost:3001/api/health

# Test project scanning
curl http://localhost:3001/api/projects

# Test Claude project detection
curl http://localhost:3001/api/claude/projects
```

### GitHub Actions CI/CD Pipeline
The project includes comprehensive automated testing via GitHub Actions:

```yaml
# Workflow runs on push to main/develop and pull requests
- HTML Validation: html-validate for markup standards compliance
- Console Error Detection: Puppeteer headless browser testing
- Functionality Testing: Automated UI interaction testing
- Accessibility Testing: axe-core WCAG compliance scanning  
- Lint Checks: File structure and markdown validation
```

**CI/CD Configuration**: `.github/workflows/ci.yml`
- **Chrome Sandbox**: Uses `--no-sandbox` flags for containerized CI environment
- **Modern APIs**: Replaces deprecated Puppeteer methods with Promise-based timeouts
- **Parallel Jobs**: Runs test, lint, and accessibility jobs concurrently
- **Quality Gates**: All tests must pass for successful builds

## API Endpoints

### Core Endpoints
- `GET /api/projects` - Scan and return all discovered projects
- `GET /api/claude/projects` - Scan specifically for Claude-enabled projects  
- `GET /api/health` - Server health check
- `GET /api/config` - Get current configuration

### Directory Management
- `POST /api/directories` - Add new scan directory
- `DELETE /api/directories` - Remove scan directory
- `PUT /api/directories` - Update entire directory list

## Project Analysis Features

### ProjectAnalyzer Class (`server.js:240+`)
- Recursive filesystem scanning with exclusion patterns
- Technology stack detection from file extensions
- Virtual environment detection for Python projects

- Automatic categorization (Web, AI/ML, Backend, etc.)
- Project status inference (Production, Development)

### ClaudeAnalyzer Class (`server.js:61-189`)
- Detects CLAUDE.md files and .claude directories
- Extracts metadata from CLAUDE.md (Name, Role patterns)

- Analyzes Claude project permissions and settings
- Determines Claude project status and activity

## Default Scan Directories

The backend scans these directories by default (configured in `server.js:14-26`):
- `/mnt/f/utility-projects`
- `/mnt/f/consciousness-projects`
- `/mnt/f/dark-forest-labs-projects`
- `/mnt/f/experimental-projects`
- `/mnt/f/science-projects`
- `/mnt/f/art-projects`
- `/mnt/f/environmental_projects`
- `/mnt/f/video-game-projects`
- `/mnt/f/ensemble_project`
- `/mnt/f/archive_family`
- `/mnt/f/webpages`

## Key File Detection Patterns

### Technology Detection
- Languages: `.py`, `.js`, `.ts`, `.html`, `.css`, `.java`, `.cpp`, `.rs`, `.go`, etc.
- Frameworks: `package.json` (Node.js), `requirements.txt` (Python), `Cargo.toml` (Rust)
- Containerization: `dockerfile`, `docker-compose.yml`

### Special Files
- Documentation: `readme.*` files
- Claude Integration: `CLAUDE.md`, `.claude/` directory
- Virtual Environments: `venv/`, `.venv/`, `env/` directories

- Configuration: `package.json`, `requirements.txt`, `setup.py`

## API Response Fields

### Claude Project Detection
Projects returned by `/api/projects` include basic Claude detection:

#### Core Fields
- `hasClaudeFile`: Boolean indicating if CLAUDE.md file exists
- `hasClaudeDir`: Boolean indicating if .claude directory exists
- `claudeRole`: Extracted role from CLAUDE.md metadata
- `permissions`: Array of Claude permissions from settings

#### Detection Logic
- **File Detection**: Looks for CLAUDE.md files and .claude directories
- **Metadata Extraction**: Parses project name and role from CLAUDE.md content
- **Settings Analysis**: Reads .claude/settings.local.json for permissions

#### Notes
- Local Claude Code CLI detection was removed (not feasible)
- Focus is on CLAUDE.md file presence and project metadata

## Frontend-Backend Communication

The frontend automatically detects backend availability and switches modes:
- **With Backend**: Dynamic project scanning, real-time updates
- **Without Backend**: Falls back to hardcoded project data for development

## Configuration Persistence

Backend configuration is persisted in `server/directories.json`:
```json
{
  "directories": ["/path/to/scan1", "/path/to/scan2"],
  "lastUpdated": "2025-01-01T00:00:00.000Z"
}
```

## Development Patterns

### Adding New Project Detection
1. Extend `ProjectAnalyzer.detectTechnologies()` for new file types
2. Update `ProjectAnalyzer.detectCategory()` for new project categories
3. Add patterns to `ProjectAnalyzer.detectStatus()` for status inference

### Adding New API Endpoints
1. Add route handler in `server.js` (after line 393)
2. Follow existing patterns for error handling and JSON responses
3. Update CORS configuration if needed

### Frontend Feature Development
1. All frontend code is in `project-tracker.html`
2. CSS is embedded in `<style>` tags (lines 12+)
3. JavaScript is embedded in `<script>` tags (end of file)
4. Use existing utility functions for consistent UX