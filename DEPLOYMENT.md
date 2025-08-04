# Deployment Guide

This document outlines various deployment options for the Project Tracker application.

## 🌐 Deployment Options

### 1. Local Development (Recommended)
The simplest way to use Project Tracker is locally on your machine.

```bash
# Clone the repository
git clone https://github.com/yourusername/project-tracker.git
cd project-tracker

# Open in browser
open project-tracker.html  # macOS
start project-tracker.html # Windows
xdg-open project-tracker.html # Linux
```

**Pros:**
- No server setup required
- Works offline
- Direct file system access
- Maximum privacy

**Cons:**
- Not accessible from other devices
- No remote collaboration

### 2. Static Web Hosting

#### GitHub Pages
```bash
# Push to GitHub repository
git push origin main

# Enable GitHub Pages in repository settings
# Select source: Deploy from a branch
# Branch: main
# Folder: / (root)
```

#### Netlify
```bash
# Build command: (none required)
# Publish directory: .
# Or drag and drop the folder to netlify.com
```

#### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Note:** File system access will be limited when hosted online.

### 3. Electron Desktop App

For a native desktop experience:

```bash
# Install Electron
npm install electron --save-dev

# Create main.js
cat > main.js << 'EOF'
const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.loadFile('project-tracker.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
EOF

# Add to package.json
cat > package.json << 'EOF'
{
  "name": "project-tracker",
  "version": "1.0.0",
  "description": "Local project tracking application",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build-mac": "electron-builder --mac",
    "build-win": "electron-builder --win",
    "build-linux": "electron-builder --linux"
  },
  "devDependencies": {
    "electron": "^latest",
    "electron-builder": "^latest"
  }
}
EOF

# Run the app
npm start
```

### 4. Progressive Web App (PWA)

Add PWA capabilities for mobile/offline use:

```bash
# Create manifest.json
cat > manifest.json << 'EOF'
{
  "name": "Project Tracker",
  "short_name": "Projects",
  "description": "Track and organize your development projects",
  "start_url": "./project-tracker.html",
  "display": "standalone",
  "background_color": "#667eea",
  "theme_color": "#667eea",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
EOF

# Create service worker
cat > sw.js << 'EOF'
const CACHE_NAME = 'project-tracker-v1';
const urlsToCache = [
  './project-tracker.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
EOF
```

Add to HTML head:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#667eea">
```

### 5. Docker Container

For consistent deployment across environments:

```dockerfile
# Dockerfile
FROM nginx:alpine

# Copy application files
COPY . /usr/share/nginx/html/

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build and run
docker build -t project-tracker .
docker run -p 8080:80 project-tracker
```

### 6. Local HTTP Server

For development with file system access:

#### Python
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

#### Node.js
```bash
# Install serve globally
npm install -g serve

# Serve current directory
serve -s . -p 8000
```

#### PHP
```bash
php -S localhost:8000
```

## 🔧 Configuration for Different Environments

### Environment-Specific Configurations

```javascript
// Add to project-tracker.html
const CONFIG = {
  development: {
    enableFileSystem: true,
    debug: true,
    mockData: false
  },
  production: {
    enableFileSystem: false,
    debug: false,
    mockData: true
  },
  electron: {
    enableFileSystem: true,
    debug: false,
    mockData: false
  }
};

// Detect environment
const environment = (() => {
  if (typeof require !== 'undefined') return 'electron';
  if (location.hostname === 'localhost') return 'development';
  return 'production';
})();

const config = CONFIG[environment];
```

### Custom Project Data

For hosted deployments, replace the hardcoded project data:

```javascript
// Replace projectsData with:
const projectsData = [
  {
    name: "Your Project 1",
    path: "https://github.com/username/project1",
    description: "Description of your project",
    lastModified: "Recently Active",
    files: "JavaScript, HTML, CSS",
    hasReadme: true,
    type: "Web/Frontend"
  }
  // Add more projects...
];
```

## 🚀 CI/CD Pipeline

### GitHub Actions Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: .
```

### Automated Releases

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Create Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        draft: false
        prerelease: false
```

## 📱 Mobile Considerations

### Responsive Design Testing
```bash
# Test mobile responsiveness
npx lighthouse http://localhost:8000 --view
```

### Touch-Friendly Interactions
- Minimum touch target size: 44px
- Proper spacing between interactive elements
- Swipe gestures for navigation

## 🔒 Security Considerations

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline';">
```

### HTTPS Requirements
- File system APIs require HTTPS in production
- Use Let's Encrypt for free SSL certificates

## 📊 Monitoring and Analytics

### Simple Analytics
```javascript
// Add to project-tracker.html
function trackEvent(action, category = 'User') {
  // Simple event tracking
  console.log(`Event: ${category} - ${action}`);
  
  // Add your analytics service here
  // gtag('event', action, { event_category: category });
}
```

### Performance Monitoring
```javascript
// Add performance monitoring
window.addEventListener('load', () => {
  const loadTime = performance.now();
  console.log(`Page loaded in ${loadTime}ms`);
});
```

## 🆘 Troubleshooting

### Common Issues

1. **File system access not working**
   - Ensure using local server (not file:// protocol)
   - Check browser security settings

2. **Projects not displaying**
   - Verify projectsData array is properly formatted
   - Check browser console for JavaScript errors

3. **Styling issues**
   - Clear browser cache
   - Verify CSS is loading properly

4. **Mobile layout problems**
   - Test with browser developer tools
   - Verify viewport meta tag is present

---

For more deployment options and advanced configurations, see the [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md) file.