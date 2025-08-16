# How to Use Project Tracker

## Local Usage (Recommended)

Just open the HTML file in your browser:

```bash
# Clone the repo
git clone https://github.com/bshepp-projects/project-tracker.git
cd project-tracker

# Open in browser
open project-tracker.html  # macOS
start project-tracker.html # Windows
xdg-open project-tracker.html # Linux
```

## With Backend API (Optional)

For dynamic project scanning:

```bash
# Start the backend
cd server && npm install && npm start

# Open project-tracker.html in browser
# It will automatically connect to http://localhost:3001
```

## That's It

The frontend works fine without the backend (uses hardcoded project data). The backend adds real-time filesystem scanning.

No deployment, no hosting, no AWS, no complexity. Just a local tool that works.