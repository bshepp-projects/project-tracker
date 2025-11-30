# Generalization Plan

Notes on making Project Tracker more portable for other users.

## Current Limitations

1. **Hardcoded fallback projects** in HTML files are specific to one environment
2. **Default directories** in server.js use WSL paths (`/mnt/f/...`)
3. **directories.json** contains environment-specific paths

## What Would Need to Change

### For General Release

1. Clear the hardcoded `projectsData` array in HTML files, or replace with generic examples
2. Change `DEFAULT_SCAN_DIRECTORIES` in server.js to empty array or common paths like `~/Projects`
3. Ship with empty `directories.json`
4. Add better first-run experience to guide users to add their directories

### Cross-Platform Improvements

- The path handling already supports Windows paths and converts them for WSL
- Would need a Windows batch file equivalent of `setup.sh`
- Port is already configurable via `PORT` environment variable

### Distribution Options

- npm package
- Docker container
- Standalone Electron app

## Current Status

This is a working personal tool. The generalization work hasn't been done, so using it requires:
1. Cloning the repo
2. Manually adding your project directories via the UI
3. Ignoring the hardcoded fallback data (it won't show if backend is running)

## Effort Estimate

~1-2 days to clean up for public release if desired.
