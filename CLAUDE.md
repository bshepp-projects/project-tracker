# CLAUDE.md

Guidance for Claude Code when working with this repository.

## What This Is

Project Tracker is a local web tool for organizing projects. It has:

- **Frontend**: Single HTML files (`project-tracker.html`, `claude-tracker.html`, `git-tracker.html`)
- **Backend**: Node.js Express server (`server/server.js`)

## Commands

```bash
# Install and run
cd server && npm install && npm start
# Server runs on http://localhost:3001

# Open frontend
open project-tracker.html  # or just double-click it
```

## Architecture

### Backend (`server/server.js`)

Main classes:
- `CacheManager` - File-based caching for scan results
- `ProjectAnalyzer` - Scans directories, detects tech stacks
- `ClaudeAnalyzer` - Detects CLAUDE.md files and .claude directories  
- `GitAnalyzer` - Git status, branch info, GitHub detection

Data files (in `server/`):
- `directories.json` - Configured scan directories
- `user-data.json` - Tags and favorites (persistent)
- `projects-cache.json` - Cached scan results

### Frontend

Single HTML files with embedded CSS and JavaScript. Communicates with backend at `http://localhost:3001/api`.

Falls back to hardcoded data if backend is unavailable.

## API Endpoints

### Projects
- `GET /api/projects` - Full scan
- `GET /api/projects/cached` - Return cache, trigger background scan if stale

### Configuration  
- `GET /api/config` - Current directories
- `POST /api/directories` - Add directory (validates path exists)
- `DELETE /api/directories` - Remove directory
- `PUT /api/directories` - Replace all directories

### User Data
- `GET /api/favorites` - List favorites
- `POST /api/favorites` - Add favorite `{ projectPath }`
- `DELETE /api/favorites` - Remove favorite `{ projectPath }`
- `GET /api/projects/:path/tags` - Get tags for project
- `POST /api/projects/:path/tags` - Save tags `{ tags: [] }`

### Other
- `GET /api/health` - Health check
- `GET /api/tags` - All tags across projects
- `GET /api/claude/projects` - Projects with CLAUDE.md
- `GET /api/git/repos` - Git repository details

## Key Behaviors

- Projects are scanned from directories listed in `directories.json`
- Each directory should be a project root, not a parent folder
- WSL path conversion: Windows paths like `C:\...` become `/mnt/c/...`
- Cache expires after 1 hour
- Tags merge auto-detected tags with user-saved tags
- Favorites and tags persist in `user-data.json`

## Adding Features

### New detection in ProjectAnalyzer
1. Add to `detectTechnologies()` for file extensions
2. Add to `detectCategory()` for project types
3. Add to `generateTags()` for auto-tagging

### New API endpoint
Add route handler in `server.js`, follow existing patterns for JSON responses.

### Frontend changes
All in the HTML files - CSS in `<style>`, JS at end of file.

## Dependencies

Backend: `express`, `cors` (that's it)

No database - everything is JSON files.
