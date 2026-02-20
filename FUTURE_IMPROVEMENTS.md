# Future Improvements

Ideas for extending Project Tracker.

## Current State

Working features:
- Project scanning with tech detection
- Git integration (branch status, commits, GitHub URLs)
- CLAUDE.md detection
- Virtual environment detection
- Tags (auto-generated + custom, server-persisted)
- Favorites (server-persisted)
- Dark/light theme
- Search and filtering
- Three interfaces: Project Tracker, Claude Tracker, Git Tracker

## Potential Improvements

### Project Detection
- [ ] File watcher for real-time updates instead of manual refresh
- [ ] Configurable exclusion patterns
- [ ] Deeper dependency analysis (npm audit, pip check)
- [ ] Test coverage detection
- [ ] License detection

### Git Features
- [ ] Commit activity heatmap
- [ ] Pull/push directly from UI
- [ ] Stash indicator
- [ ] GitHub Actions status (currently requires `gh` CLI)

### UI/UX
- [ ] Drag-and-drop project ordering
- [ ] Custom project notes/descriptions
- [ ] Project grouping/folders
- [ ] Export to CSV/JSON
- [ ] Keyboard navigation beyond Ctrl+R

### Performance
- [ ] Virtual scrolling for 100+ projects
- [ ] Incremental scanning
- [ ] Better caching strategy

### Technical
- [x] TypeScript conversion (completed v2.0.0)
- [x] Test suite (completed v2.0.0 -- Jest with ts-jest, unit + API integration tests)
- [ ] Docker deployment option

## Not Planned

- Cloud sync (this is a local tool)
- Multi-user support
- Mobile app
