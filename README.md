# Project Tracker

A local tool to find and organize projects across multiple directories.

## What It Does

- Scans directories you specify and displays projects in a web interface
- Detects technology stacks, git status, CLAUDE.md files, virtual environments
- Tags projects automatically based on content; you can add custom tags
- Favorites and tags are persisted server-side
- Dark/light theme

## Requirements

- Node.js 16+
- A browser

## Setup

```bash
cd project-tracker
cd server && npm install
npm start
# Server runs on http://localhost:3001

# Open project-tracker.html in your browser
```

Or use the setup script:
```bash
./setup.sh
cd server && npm start
```

## Usage

1. Open `project-tracker.html` in your browser
2. Click "Manage Directories" to add project paths
3. Projects are scanned and displayed with detected info
4. Use search to filter, click stars to favorite
5. Tags can be edited via "Manage Tags"

### Path Formats Supported

- Windows: `C:\Users\Name\Projects\my-app`
- Unix: `/home/user/projects/my-app`
- WSL paths are converted automatically

## Project Structure

```
project-tracker/
├── project-tracker.html    # Main interface
├── claude-tracker.html     # Claude projects view
├── git-tracker.html        # Git repository view
└── server/
    ├── server.js           # Express backend
    ├── package.json
    ├── directories.json    # Configured directories (generated)
    └── user-data.json      # Tags and favorites (generated)
```

## API Endpoints

- `GET /api/projects` - Scan and return projects
- `GET /api/projects/cached` - Return cached projects (faster)
- `GET /api/config` - Current configuration
- `POST /api/directories` - Add a directory
- `DELETE /api/directories` - Remove a directory
- `GET /api/favorites` - Get favorites list
- `POST /api/favorites` - Add favorite
- `DELETE /api/favorites` - Remove favorite
- `POST /api/projects/:path/tags` - Save tags for a project
- `GET /api/tags` - Get all tags

## What Gets Detected

- **Technologies**: Python, JavaScript, TypeScript, Rust, Go, Java, etc.
- **Frameworks**: Node.js, Docker, Python packages
- **Git info**: Branch, ahead/behind status, last commit, GitHub URL
- **Project files**: README, CLAUDE.md, virtual environments

## Data Storage

All data is local:
- `directories.json` - which directories to scan
- `user-data.json` - your tags and favorites
- `projects-cache.json` - cached scan results

No external services, no tracking.

## Keyboard Shortcuts

- `Ctrl+R` - Refresh projects
- `Escape` - Close modals

## License

MIT
