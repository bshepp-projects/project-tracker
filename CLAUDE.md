# CLAUDE.md

Guidance for Claude Code when working with this repository.

## What This Is

Project Tracker is a local web tool for organizing projects. It has:

- **Frontend**: HTML files (`project-tracker.html`, `claude-tracker.html`, `git-tracker.html`) with shared CSS/JS in `shared/`
- **Backend**: TypeScript Express server in `server/src/`, compiled to `server/dist/`

## Commands

```bash
# Install and run
cd server && npm install && npm start
# Server runs on http://localhost:3001

# Development mode (auto-reloads on changes)
cd server && npm run dev

# Build TypeScript only
cd server && npm run build

# Run tests
cd server && npm test

# Open frontend
open project-tracker.html  # or just double-click it
```

## Architecture

### Backend (`server/src/`)

TypeScript source compiled to `server/dist/`. Entry point: `src/index.ts` wires up services and starts the server. `src/app.ts` creates the Express app (separated for testability).

Instance-based service classes (constructor-injected dependencies):
- `CacheManager` (`services/cache-manager.ts`) - File-based caching with 1-hour TTL
- `ProjectAnalyzer` (`services/project-analyzer.ts`) - Scans directories, detects tech stacks, generates tags
- `ClaudeAnalyzer` (`services/claude-analyzer.ts`) - Detects CLAUDE.md files and .claude directories
- `GitAnalyzer` (`services/git-analyzer.ts`) - Git status, branch info, GitHub detection (uses `execFile`, never a shell)
- `ProjectDiscovery` (`services/project-discovery.ts`) - Walks configured roots to find project dirs by marker; reports skipped paths
- `UserData` (`services/user-data.ts`) - Persists tags and favorites

`services/action-command.ts` is a pure builder (action name + path → spawn spec or copy text) used by the local action bridge.

Route handlers are in `src/routes/` (one file per resource: projects, directories, tags, favorites, git, claude, health, actions).

Tag generation uses data-driven rules from `src/config/tag-rules.json` (editable without code changes).

Types are defined in `src/types.ts`.

Data files (in `server/`, not `src/`):
- `directories.json` - Scan config: `roots` (parents auto-scanned for projects), `directories` (explicit project pins, legacy key), `exclude` (extra basenames to skip), `maxDepth` (default 3). All keys optional; legacy `{ "directories": [...] }` still works. Gitignored — local-only, not committed.
- `user-data.json` - Tags and favorites (persistent)
- `projects-cache.json` - Cached scan results

### Frontend

HTML files link shared assets from `shared/`:
- `shared/shared.css` - Common styles (reset, nav, modals, theme, responsive)
- `shared/shared.js` - Common JS (escapeHtml, theme toggle, notifications, directory/tag management)

Each HTML file has only page-specific CSS and JS. All dynamic data is sanitized via `escapeHtml()` / `escapeJsStr()` before `innerHTML` injection.

Communicates with backend at `http://localhost:3001/api`. Falls back to hardcoded data if backend is unavailable.

## API Endpoints

### Projects
- `GET /api/projects` - Full scan. Response includes `discovery: { rootsScanned, projectsFound, skipped: [{path,reason}] }`
- `GET /api/projects/cached` - Return cache, trigger background scan if stale (also returns `discovery`)

### Configuration
- `GET /api/config` - Current directories
- `POST /api/directories` - Add directory (validates path exists)
- `DELETE /api/directories` - Hide a project: adds its normalized path to `exclude` (path-containment validated)
- `POST /api/directories/restore` - Unhide a project: removes its path from `exclude`
- `PUT /api/directories` - Replace all directories

### User Data
- `GET /api/favorites` - List favorites
- `POST /api/favorites` - Add favorite `{ projectPath }`
- `DELETE /api/favorites` - Remove favorite `{ projectPath }`
- `GET /api/projects/:path/tags` - Get tags for project
- `POST /api/projects/:path/tags` - Save tags `{ tags: [] }`

### Local Actions (localhost-gated)
- `GET /api/actions/status` - `{ enabled }` — whether the bridge is usable
- `POST /api/actions/:action` - Run an allowlisted action `{ projectPath }`. Actions: `open-folder`, `open-terminal`, `launch-claude`, `launch-claude-yolo`, `activate-venv`. Returns `{ mode: 'launched' }` or `{ mode: 'copy', text }`.

### Other
- `GET /api/health` - Health check
- `GET /api/tags` - All tags across projects
- `DELETE /api/tags/:tagName` - Remove a tag from all projects
- `GET /api/claude/projects` - Projects with CLAUDE.md
- `GET /api/git/repos` - Git repository details

## Key Behaviors

- Projects come from **discovery**: each `roots` entry is walked to `maxDepth`; a directory is a project if it contains a marker (`.git`, `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `CLAUDE.md`) and descent stops there. `directories` entries are explicit pins included regardless. (Pointing a root at a *parent* folder is now the intended usage — the old "each entry must be a single project root" rule no longer applies.)
- Missing/inaccessible roots and pins are reported in the `discovery.skipped` array and surfaced in the UI — never silently dropped.
- Discovery skips `node_modules`/`venv`/`__pycache__`/`dist`/`build`, anything in `exclude`, dot-dirs (except `.claude`), and does not follow symlinks (cycle-safe).
- `isPathWithinScanDirs` validates client-supplied paths (tags/favorites/actions) against pins + roots.
- `exclude` entries are matched by **basename** (relative entries — manual config-noise filters, never surfaced) **or full resolved path** (absolute entries — added by 🚫 Remove). Path-excluded projects are returned by `/api/projects` flagged `hidden:true` with `discovery.hiddenCount`, hidden in the UI by default, revealable + un-hideable via the "Show hidden" toggle. Removing never deletes a pin — it masks via `exclude` so the action is fully reversible.
- **Local action bridge** is off by default. It only executes when ALL hold: `ENABLE_LOCAL_ACTIONS` is set, the server is bound to loopback, and the request comes from a loopback address. Otherwise it 403s with `actionsDisabled` (so it is provably inert on a `0.0.0.0`/remote box like Magus). Commands are built by a fixed per-OS allowlist and spawned with no shell.
- WSL path conversion: Windows paths like `C:\...` become `/mnt/c/...`
- Cache expires after 1 hour
- Tags merge auto-detected tags with user-saved tags
- Favorites and tags persist in `user-data.json`
- Tag rules in `src/config/tag-rules.json` drive project-specific tag detection

## Adding Features

### New detection in ProjectAnalyzer
1. Add to `detectTechnologies()` in `src/services/project-analyzer.ts` for file extensions
2. Add to `detectCategory()` for project types
3. Add to `generateTags()` for auto-tagging, or add a rule to `src/config/tag-rules.json`

### New API endpoint
1. Create a route file in `src/routes/`
2. Register it in `src/app.ts`
3. Add types to `src/types.ts` if needed

### Frontend changes
- Shared styles/logic: edit `shared/shared.css` or `shared/shared.js`
- Page-specific: edit the relevant HTML file's `<style>` or `<script>` block

## Testing

Tests use Jest with ts-jest. Test files are in `server/src/__tests__/`.

- **Unit tests** (`__tests__/services/` + `__tests__/utils.test.ts`): CacheManager, ProjectAnalyzer, ClaudeAnalyzer, GitAnalyzer (incl. a command-injection regression test), UserData, ProjectDiscovery, buildActionCommand, utils (path containment / CORS / loopback)
- **API tests** (`__tests__/routes/` + `cors.test.ts`): health, favorites, tags, directories, path-validation, actions (incl. an explicit "inert on a Magus-like 0.0.0.0 host" test), using supertest
- **Test helpers** (`__tests__/test-helpers.ts`): factories for creating isolated test instances

Run `npm test` from `server/`.

## Dependencies

Runtime: `express`, `cors`
Dev: `typescript`, `tsx`, `jest`, `ts-jest`, `supertest` + type definitions

No database -- everything is JSON files.
