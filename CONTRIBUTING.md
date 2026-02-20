# Contributing

## Setup

```bash
git clone https://github.com/bshepp-projects/project-tracker.git
cd project-tracker/server
npm install
npm start
# Open project-tracker.html in browser
```

For development with auto-reload:
```bash
npm run dev
```

## Making Changes

- **Backend**: Edit TypeScript files in `server/src/`. Services live in `src/services/`, routes in `src/routes/`, types in `src/types.ts`.
- **Shared frontend**: Edit `shared/shared.css` or `shared/shared.js` for styles/logic common to all pages.
- **Page-specific frontend**: Edit the `<style>` or `<script>` blocks within the individual HTML files.
- **Tag rules**: Edit `server/src/config/tag-rules.json` to add or change tag detection patterns.

## Testing

Run the test suite before submitting changes:
```bash
cd server && npm test
```

Add tests for new backend features in `server/src/__tests__/`.

## Pull Requests

1. Fork and clone
2. Create a branch (`git checkout -b fix-something`)
3. Make changes
4. Run `npm test` and ensure tests pass
5. Test in at least one browser
6. Push and open a PR

## Code Style

- 2-space indentation
- camelCase for JS/TS, kebab-case for CSS classes
- Backend is TypeScript (compiled via `npm run build`)
- Frontend is vanilla JS with no build step -- just `<script src>` and `<link>`

## Questions

Open an issue.
