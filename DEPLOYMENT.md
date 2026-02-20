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

`npm start` automatically builds the TypeScript source before starting. Server runs on `http://localhost:3001`. Open `project-tracker.html` in your browser.

### Option 3: Frontend Only (No Backend)

Just open `project-tracker.html` directly. It will use fallback data and won't be able to scan your filesystem.

### Development Mode

For auto-reloading during development:
```bash
cd server && npm run dev
```

## Configuration

### Changing the Port

```bash
PORT=8080 npm start
```

Update `API_BASE_URL` in `shared/shared.js` if you change the port.

### Adding Project Directories

Either:
1. Use the "Manage Directories" button in the UI
2. Edit `server/directories.json` directly

### Customizing Tag Detection

Edit `server/src/config/tag-rules.json` to add rules for auto-detecting tags based on project names or paths. Changes take effect on server restart.

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

If the TypeScript build fails, check for errors with `npm run build`.

### Frontend can't connect

Check that:
1. Backend is running (`curl http://localhost:3001/api/health`)
2. No CORS errors in browser console
3. `API_BASE_URL` in `shared/shared.js` matches your server

### Different port needed

```bash
PORT=3002 npm start
```

Then update `API_BASE_URL` in `shared/shared.js`.

### Running tests

```bash
cd server && npm test
```
