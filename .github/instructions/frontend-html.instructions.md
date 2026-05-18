---
applyTo: "*.html"
description: "Use when editing frontend HTML pages. Covers XSS prevention, shared assets, and vanilla JS conventions."
---
# Frontend HTML Conventions

- **XSS prevention is mandatory**: Prefer safe DOM construction (`textContent`, `createElement`, setting `.title`/attributes as properties) over `innerHTML`. Where `innerHTML` is genuinely needed, every dynamic value must pass through `escapeHtml()` / `escapeJsStr()` from `shared/shared.js`. Never build `innerHTML` from raw/interpolated dynamic data.
- No build step — vanilla HTML/CSS/JS only. No frameworks, no bundlers, no transpilers.
- Three pages (`project-tracker.html`, `claude-tracker.html`, `git-tracker.html`) share common assets from `shared/shared.css` and `shared/shared.js`.
- Page-specific styles go in `<style>` blocks within the HTML file, not in shared CSS (unless truly shared).
- Page-specific scripts go in `<script>` blocks within the HTML file, not in shared JS.
- API base URL is `http://localhost:3001/api` — use `fetch()` for all backend calls.
- CSS classes use kebab-case. JS uses camelCase.
