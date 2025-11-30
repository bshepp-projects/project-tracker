# Project Tracker Deployment

## Requirements

- Node.js 16+
- A web browser

## Setup

### Option 1: Quick Setup

```bash
git clone https://github.com/bshepp-projects/project-tracker.git
cd project-tracker
./setup.sh
cd server && npm start
```

Then open `project-tracker.html` in your browser.

### Option 2: Manual Setup

```bash
git clone https://github.com/bshepp-projects/project-tracker.git
cd project-tracker/server
npm install
npm start
```

Server runs on `http://localhost:3001`. Open `project-tracker.html` in your browser.

### Option 3: Frontend Only (No Backend)

Just open `project-tracker.html` directly. It will use fallback data and won't be able to scan your filesystem.

## Configuration

### Changing the Port

```bash
PORT=8080 npm start
```

Update `API_BASE_URL` in the HTML files if you change the port.

### Adding Project Directories

Either:
1. Use the "Manage Directories" button in the UI
2. Edit `server/directories.json` directly

## Data Files

All generated in `server/`:
- `directories.json` - Which directories to scan
- `user-data.json` - Your tags and favorites
- `projects-cache.json` - Cached scan results

## Troubleshooting

### Backend won't start

```bash
cd server && npm install
npm start
```

### Frontend can't connect

Check that:
1. Backend is running (`curl http://localhost:3001/api/health`)
2. No CORS errors in browser console
3. `API_BASE_URL` in HTML matches your server

### Different port needed

```bash
PORT=3002 npm start
```

Then update `API_BASE_URL` in the HTML files.
