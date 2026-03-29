# Project Guidelines

## Build and Test

```bash
cd server
npm install        # Install dependencies
npm run build      # Compile TypeScript to dist/
npm start          # Build + start server on :3001
npm run dev        # Dev mode with auto-reload (tsx watch)
npm test           # Run Jest tests
```

Server binds to `http://localhost:3001` by default. PORT and HOST are configurable via environment variables.

## Architecture

**Backend** (`server/src/`): TypeScript Express server compiled to `server/dist/`.

- **Services** are instance-based classes with constructor-injected dependencies. All instantiated once in `index.ts` and passed to `createApp()` via an `AppDependencies` interface.
- **Routes** are factory functions (`create<Resource>Router(deps)`) that return Express Routers, registered under `/api` in `app.ts`. Each route receives only the dependencies it needs.
- **App vs Index split**: `app.ts` creates the Express app (for testability); `index.ts` orchestrates startup.

**Frontend**: Vanilla HTML/CSS/JS — no build step. Three HTML pages share assets from `shared/`. All dynamic content is sanitized via `escapeHtml()`/`escapeJsStr()` before `innerHTML` injection.

**Data**: JSON files in `server/` (not `src/`): `directories.json`, `user-data.json`, `projects-cache.json`. No database.

## Conventions

- **Dependency injection**: Never import services directly in routes. Routes receive dependencies via factory function parameters.
- **Tag rules**: Auto-tagging is data-driven via `src/config/tag-rules.json` — add rules there, not code changes in `ProjectAnalyzer`.
- **Test isolation**: Tests use helper factories from `__tests__/test-helpers.ts` that create temporary file-backed instances. Never use production data files in tests.
- **WSL paths**: Windows paths (`C:\...`) are auto-converted to `/mnt/c/...` on Linux. See `routes/directories.ts`.
- **XSS prevention**: All user-facing dynamic data in frontend HTML must go through `escapeHtml()` or `escapeJsStr()`. Never use raw `innerHTML`.
- **Code style**: 2-space indentation, camelCase for TS/JS, kebab-case for CSS classes.

## Adding Features

| What | Where |
|------|-------|
| New API endpoint | Create route in `src/routes/`, register in `app.ts`, add types to `types.ts` |
| New detection/tagging | Add rule to `src/config/tag-rules.json`, or extend `ProjectAnalyzer` methods |
| Frontend shared logic | Edit `shared/shared.css` or `shared/shared.js` |
| Page-specific changes | Edit `<style>`/`<script>` in the relevant HTML file |

## Key References

- [CLAUDE.md](../CLAUDE.md) — Detailed architecture, API endpoints, and all commands
- [CONTRIBUTING.md](../CONTRIBUTING.md) — PR workflow, code style, and development setup
- [DEPLOYMENT.md](../DEPLOYMENT.md) — Setup options and configuration
- [SECURITY.md](../SECURITY.md) — Security scope and assumptions (local-only tool)
