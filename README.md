# Project Tracker

A local tool to find and organize projects across multiple directories.

## What It Does

- Auto-discovers projects under the parent folders ("roots") you configure — no need to list every project by hand
- Detects technology stacks, git status, CLAUDE.md files, virtual environments
- Tags projects automatically based on content; you can add custom tags
- Favorites and tags are persisted server-side
- Optional local action bridge: when run locally with a flag, the per-project buttons (open folder, launch Claude, etc.) actually execute instead of just copying a command
- Dark/light theme

## Requirements

- Node.js 18+ (the compiled server itself runs on 16, but the dev/test tooling — tsx, jest — needs 18)
- A browser

## Setup

```bash
cd project-tracker
cd server && npm install
npm start
# Builds TypeScript and starts the server on http://localhost:3001

# Open project-tracker.html in your browser
```

Or use the setup script:
```bash
./setup.sh
cd server && npm start
```

For development with auto-reload:
```bash
cd server && npm run dev
```

## Usage

1. Open `project-tracker.html` in your browser
2. Configure scan locations (see "Scanning" below) — point `roots` at parent folders and projects are found automatically; "Manage Directories" adds explicit pins
3. Projects are scanned and displayed with detected info; a line under the stats shows how many were found vs. any configured paths that were unavailable
4. Use search to filter, click stars to favorite
5. Tags can be edited via "Manage Tags"

### Scanning

`server/directories.json` controls what is scanned. All keys optional:

```jsonc
{
  "roots":   ["F:\\projects", "F:\\work"],  // parents — auto-discover projects inside
  "directories": ["F:\\one-off\\thing"],    // explicit pins (also the legacy format)
  "exclude": ["archive"],                    // extra directory names to skip
  "maxDepth": 3                              // how deep to walk under each root
}
```

A directory counts as a project if it contains a marker (`.git`, `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, or `CLAUDE.md`); discovery stops descending there. `node_modules`, `venv`, `dist`, etc. and symlinks are skipped. Anything unreachable is reported in the UI, not silently dropped. A legacy `{ "directories": [...] }` file still works unchanged. The 🚫 Remove button hides a single project by adding its full path to `exclude`; hidden projects are off by default and revealed via the "Show hidden" toggle, where each has an ↩️ Unhide action.

### Local Actions (opt-in)

By default the action buttons copy a command to the clipboard. To make them actually run on your machine, start the server **locally** with:

```bash
cd server && ENABLE_LOCAL_ACTIONS=1 npm start
```

The bridge only works when the server is bound to localhost **and** the request comes from the same machine, so it stays inert on any networked/reverse-proxied deployment. Without the flag, buttons fall back to copying the command (and say so).

### Path Formats Supported

- Windows: `C:\Users\Name\Projects\my-app`
- Unix: `/home/user/projects/my-app`
- WSL paths are converted automatically

## Project Structure

```
project-tracker/
├── project-tracker.html       # Main interface
├── claude-tracker.html        # Claude projects view
├── git-tracker.html           # Git repository view
├── shared/
│   ├── shared.css             # Common styles (theme, nav, modals, responsive)
│   └── shared.js              # Common JS (escapeHtml, theme, notifications, directory/tag mgmt)
└── server/
    ├── package.json
    ├── tsconfig.json
    ├── jest.config.js
    ├── server.js              # Backward-compat shim → dist/index.js
    ├── src/
    │   ├── index.ts           # Entry point (wires services, starts server)
    │   ├── app.ts             # Express app factory
    │   ├── types.ts           # Shared TypeScript interfaces
    │   ├── utils.ts           # Shared utilities
    │   ├── services/
    │   │   ├── cache-manager.ts
    │   │   ├── project-analyzer.ts
    │   │   ├── project-discovery.ts   # Walks roots → project dirs
    │   │   ├── claude-analyzer.ts
    │   │   ├── git-analyzer.ts
    │   │   ├── action-command.ts      # Pure action→command builder
    │   │   └── user-data.ts
    │   ├── routes/
    │   │   ├── projects.ts
    │   │   ├── directories.ts
    │   │   ├── tags.ts
    │   │   ├── favorites.ts
    │   │   ├── git.ts
    │   │   ├── claude.ts
    │   │   ├── actions.ts             # Localhost-gated action bridge
    │   │   └── health.ts
    │   ├── config/
    │   │   └── tag-rules.json # Data-driven tag detection rules
    │   └── __tests__/         # Jest test suite
    ├── dist/                  # Compiled output (gitignored)
    ├── directories.json       # Scan config: roots/directories/exclude/maxDepth (gitignored, local-only)
    ├── user-data.json         # Tags and favorites (generated)
    └── projects-cache.json    # Cached scan results (generated)
```

## API Endpoints

- `GET /api/projects` - Scan and return projects
- `GET /api/projects/cached` - Return cached projects (faster)
- `GET /api/config` - Full scan config (pins, roots, exclude, maxDepth)
- `POST /api/directories` - Add a directory pin
- `DELETE /api/directories` - Hide a project (adds its path to the exclude list)
- `POST /api/directories/restore` - Unhide a project (removes its path from exclude)
- `PUT /api/directories` - Replace all directory pins
- `GET /api/favorites` - Get favorites list
- `POST /api/favorites` - Add favorite
- `DELETE /api/favorites` - Remove favorite
- `GET /api/projects/:path/tags` - Get tags for a project
- `POST /api/projects/:path/tags` - Save tags for a project
- `GET /api/tags` - Get all tags
- `DELETE /api/tags/:tagName` - Remove a tag from all projects
- `GET /api/claude/projects` - Projects with CLAUDE.md
- `GET /api/git/repos` - Git repository details
- `GET /api/actions/status` - Whether the local action bridge is usable
- `POST /api/actions/:action` - Run an allowlisted local action (gated)
- `GET /api/health` - Health check

## What Gets Detected

- **Technologies**: Python, JavaScript, TypeScript, Rust, Go, Java, etc.
- **Frameworks**: Node.js, Docker, Python packages
- **Git info**: Branch, ahead/behind status, last commit, GitHub URL
- **Project files**: README, CLAUDE.md, virtual environments

## Data Storage

All data is local:
- `directories.json` - scan config (roots / pins / exclude / maxDepth); gitignored, never committed
- `user-data.json` - your tags and favorites
- `projects-cache.json` - cached scan results

No external services, no tracking.

## Testing

```bash
cd server && npm test
```

Unit tests cover the backend services (CacheManager, ProjectAnalyzer, ProjectDiscovery, ClaudeAnalyzer, GitAnalyzer incl. a command-injection regression test, UserData) and the pure helpers (path containment, CORS, loopback, action-command builder). API integration tests (supertest) cover health, favorites, tags, directories, path validation, claude/git/projects routes, CORS, and the action bridge — including a test that it stays inert on a Magus-like `0.0.0.0` host.

## Keyboard Shortcuts

- `Ctrl+R` - Refresh projects
- `Escape` - Close modals

## License

MIT
