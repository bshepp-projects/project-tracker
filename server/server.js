const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3001;

// Enable CORS for frontend access
app.use(cors());
app.use(express.json());

// Configuration - individual project directories to scan
// NOTE: Each directory should be a specific project directory, not a parent containing multiple projects
const DEFAULT_SCAN_DIRECTORIES = [
    '/mnt/f/utility-projects/project-tracker',
    '/mnt/f/utility-projects/fundo-matic'
];

// Dynamic scan directories (can be modified at runtime)
let scanDirectories = [...DEFAULT_SCAN_DIRECTORIES];

// Persistence functions
const DIRECTORIES_CONFIG_FILE = path.join(__dirname, 'directories.json');

async function loadDirectoriesFromFile() {
    try {
        const data = await fs.readFile(DIRECTORIES_CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        if (Array.isArray(config.directories)) {
            scanDirectories = config.directories;
            console.log(`📂 Loaded ${scanDirectories.length} directories from config file`);
        }
    } catch (error) {
        console.log(`📂 Using default directories (config file not found or invalid)`);
    }
}

async function saveDirectoriesToFile() {
    try {
        const config = {
            directories: scanDirectories,
            lastUpdated: new Date().toISOString()
        };
        await fs.writeFile(DIRECTORIES_CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log(`💾 Saved directories configuration to ${DIRECTORIES_CONFIG_FILE}`);
    } catch (error) {
        console.error('Error saving directories config:', error);
    }
}

// Claude project analysis functions
class ClaudeAnalyzer {
    static async analyzeClaudeProject(projectPath, projectName) {
        try {
            const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
            const claudeDirPath = path.join(projectPath, '.claude');
            
            // Check for Claude files
            const hasClaudeFile = await this.fileExists(claudeMdPath);
            const hasClaudeDir = await this.fileExists(claudeDirPath);
            
            // Skip if no Claude indicators
            if (!hasClaudeFile && !hasClaudeDir) {
                return null;
            }
            
            // Extract Claude metadata
            let claudeRole = null;
            let claudeName = projectName;
            let permissions = [];
            let lastActivity = null;
            
            if (hasClaudeFile) {
                const claudeContent = await fs.readFile(claudeMdPath, 'utf8').catch(() => '');
                const metadata = this.extractClaudeMetadata(claudeContent);
                claudeRole = metadata.role;
                claudeName = metadata.name || projectName;
            }
            
            if (hasClaudeDir) {
                const settingsPath = path.join(claudeDirPath, 'settings.local.json');
                try {
                    const settingsContent = await fs.readFile(settingsPath, 'utf8');
                    const settings = JSON.parse(settingsContent);
                    permissions = settings.permissions?.allow || [];
                } catch (error) {
                    // Settings file might not exist or be invalid
                }
            }
            
            // Get last activity
            const stats = await fs.stat(hasClaudeFile ? claudeMdPath : claudeDirPath);
            lastActivity = stats.mtime;
            
            // Check for local Claude Code installation
            const hasLocalClaude = await this.detectLocalClaudeInstall(projectPath);
            
            // Determine status
            const status = this.determineClaudeStatus(hasClaudeFile, hasClaudeDir, lastActivity);
            
            return {
                name: claudeName,
                path: projectPath,
                claudeRole: claudeRole,
                hasClaudeFile: hasClaudeFile,
                hasClaudeDir: hasClaudeDir,
                hasLocalClaude: hasLocalClaude,
                permissions: permissions,
                permissionCount: permissions.length,
                lastActivity: lastActivity.toISOString(),
                lastModified: lastActivity.getFullYear().toString(),
                status: status,
                projectType: this.inferProjectType(claudeRole),
                isClaudeEnabled: true,
                dateScanned: new Date().toISOString()
            };
        } catch (error) {
            console.warn(`Error analyzing Claude project ${projectName}:`, error.message);
            return null;
        }
    }
    
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    static async detectLocalClaudeInstall(projectPath) {
        // Check common virtual environment paths for Claude installation
        const claudePaths = [
            'venv/bin/claude',
            'venv/Scripts/claude.exe',
            '.venv/bin/claude', 
            '.venv/Scripts/claude.exe',
            'env/bin/claude',
            'env/Scripts/claude.exe',
            'virtualenv/bin/claude',
            'virtualenv/Scripts/claude.exe'
        ];
        
        for (const claudePath of claudePaths) {
            const fullPath = path.join(projectPath, claudePath);
            if (await this.fileExists(fullPath)) {
                return true;
            }
        }
        
        // Check for pip-installed Claude packages in site-packages
        const venvPaths = ['venv', '.venv', 'env', 'virtualenv'];
        
        for (const venvPath of venvPaths) {
            const venvDir = path.join(projectPath, venvPath);
            if (await this.fileExists(venvDir)) {
                try {
                    // Find Python lib directory
                    const libPath = path.join(venvDir, 'lib');
                    if (await this.fileExists(libPath)) {
                        const libDirs = await fs.readdir(libPath);
                        for (const libDir of libDirs) {
                            if (libDir.startsWith('python')) {
                                const sitePackagesPath = path.join(libPath, libDir, 'site-packages');
                                if (await this.fileExists(sitePackagesPath)) {
                                    const packages = await fs.readdir(sitePackagesPath);
                                    // Check for Claude or Anthropic packages
                                    const claudePackages = packages.filter(pkg => 
                                        pkg.toLowerCase().includes('claude') || 
                                        pkg.toLowerCase().includes('anthropic')
                                    );
                                    if (claudePackages.length > 0) {
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    // Continue to next venv path if this one fails
                }
            }
        }
        
        return false;
    }
    
    static extractClaudeMetadata(content) {
        const metadata = { name: null, role: null };
        
        // Extract name from **Name:** pattern
        const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i);
        if (nameMatch) {
            metadata.name = nameMatch[1].trim();
        }
        
        // Extract role from **Role:** pattern
        const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/i);
        if (roleMatch) {
            metadata.role = roleMatch[1].trim();
        }
        
        return metadata;
    }
    
    static determineClaudeStatus(hasClaudeFile, hasClaudeDir, lastActivity) {
        const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        
        if (hasClaudeFile && hasClaudeDir) {
            return daysSinceActivity < 7 ? 'Active' : 'Configured';
        } else if (hasClaudeFile) {
            return 'Partial Setup';
        } else {
            return 'Directory Only';
        }
    }
    
    static inferProjectType(role) {
        if (!role) return 'General';
        
        const roleLower = role.toLowerCase();
        if (roleLower.includes('web') || roleLower.includes('frontend') || roleLower.includes('backend')) {
            return 'Web Development';
        }
        if (roleLower.includes('ai') || roleLower.includes('ml') || roleLower.includes('machine learning')) {
            return 'AI/ML';
        }
        if (roleLower.includes('data') || roleLower.includes('analysis') || roleLower.includes('science')) {
            return 'Data Science';
        }
        if (roleLower.includes('game') || roleLower.includes('unity')) {
            return 'Game Development';
        }
        if (roleLower.includes('math') || roleLower.includes('geometry') || roleLower.includes('algorithm')) {
            return 'Mathematical Computing';
        }
        
        return 'General';
    }
}

// Project analysis functions
class ProjectAnalyzer {
    static async analyzeProject(projectPath, projectName) {
        try {
            const files = await this.getFilesRecursively(projectPath);
            const fileNames = files.map(f => path.basename(f).toLowerCase());
            const extensions = files.map(f => path.extname(f).toLowerCase().slice(1)).filter(ext => ext);
            
            // Auto-detect features
            const hasReadme = fileNames.some(name => name.startsWith('readme'));
            const hasClaude = fileNames.includes('claude.md');
            const hasVenv = await this.detectVirtualEnv(projectPath, files);
            const hasLocalClaude = await ClaudeAnalyzer.detectLocalClaudeInstall(projectPath);
            
            // Detect technologies and category
            const technologies = this.detectTechnologies(extensions, fileNames);
            const category = this.detectCategory(extensions, fileNames, projectName);
            const status = this.detectStatus(fileNames, extensions);
            
            // Get last modified date
            const stats = await fs.stat(projectPath);
            const lastModified = stats.mtime.getFullYear().toString();
            
            return {
                name: projectName,
                path: projectPath,
                description: `Auto-detected project: ${projectName}`,
                status: status,
                technologies: technologies,
                category: category,
                tags: this.generateTags(status, technologies, category),
                hasReadme: hasReadme,
                hasClaude: hasClaude,
                hasVenv: hasVenv,
                hasLocalClaude: hasLocalClaude,
                lastUpdated: lastModified,
                isScanned: true,
                dateScanned: new Date().toISOString()
            };
        } catch (error) {
            console.warn(`Error analyzing project ${projectName}:`, error.message);
            return null;
        }
    }
    
    static async getFilesRecursively(dir, files = []) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                // Skip hidden files and common ignore patterns
                if (entry.name.startsWith('.') && !entry.name.startsWith('.env')) continue;
                if (entry.name === 'node_modules') continue;
                if (entry.name === '__pycache__') continue;
                if (entry.name === '.git') continue;
                
                if (entry.isDirectory()) {
                    // Limit recursion depth to avoid infinite loops
                    if (files.length < 1000) {
                        await this.getFilesRecursively(fullPath, files);
                    }
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
        
        return files;
    }
    
    static async detectVirtualEnv(projectPath, files) {
        try {
            // Check for venv directories
            const entries = await fs.readdir(projectPath);
            const hasVenvDir = entries.some(entry => 
                entry === 'venv' || entry === '.venv' || entry === 'env'
            );
            
            // Check for Python requirements file
            const hasRequirements = files.some(f => 
                path.basename(f).toLowerCase() === 'requirements.txt'
            );
            
            return hasVenvDir || hasRequirements;
        } catch (error) {
            return false;
        }
    }
    
    static detectTechnologies(extensions, fileNames) {
        const techMap = {
            'py': 'Python',
            'js': 'JavaScript', 
            'ts': 'TypeScript',
            'html': 'HTML',
            'css': 'CSS',
            'java': 'Java',
            'cpp': 'C++',
            'c': 'C',
            'rs': 'Rust',
            'go': 'Go',
            'php': 'PHP',
            'rb': 'Ruby',
            'swift': 'Swift',
            'kt': 'Kotlin',
            'vue': 'Vue.js',
            'jsx': 'React',
            'tsx': 'React'
        };
        
        const detected = new Set();
        
        extensions.forEach(ext => {
            if (techMap[ext]) {
                detected.add(techMap[ext]);
            }
        });
        
        // Special framework detection
        if (fileNames.includes('package.json')) detected.add('Node.js');
        if (fileNames.includes('cargo.toml')) detected.add('Rust');
        if (fileNames.includes('requirements.txt') || fileNames.includes('setup.py')) detected.add('Python');
        if (fileNames.includes('dockerfile')) detected.add('Docker');
        if (fileNames.includes('docker-compose.yml')) detected.add('Docker');
        if (fileNames.includes('pom.xml')) detected.add('Maven');
        if (fileNames.includes('build.gradle')) detected.add('Gradle');
        
        return Array.from(detected).join(', ') || 'Mixed';
    }
    
    static detectCategory(extensions, fileNames, projectName) {
        const name = projectName.toLowerCase();
        
        // Check project name patterns
        if (name.includes('web') || name.includes('site') || fileNames.includes('index.html')) {
            return 'Web Application';
        }
        if (name.includes('ai') || name.includes('ml') || name.includes('neural')) {
            return 'AI/ML Project';
        }
        if (name.includes('api') || name.includes('server') || name.includes('backend')) {
            return 'Backend Service';
        }
        if (name.includes('mobile') || name.includes('app')) {
            return 'Mobile Application';
        }
        if (name.includes('bot') || name.includes('discord') || name.includes('telegram')) {
            return 'Bot/Automation';
        }
        if (name.includes('game') || name.includes('unity')) {
            return 'Game Development';
        }
        
        // Check file patterns
        if (fileNames.includes('setup.py') || fileNames.includes('__init__.py')) {
            return 'Python Package';
        }
        if (fileNames.includes('package.json')) {
            return 'Node.js Project';
        }
        if (extensions.includes('unity') || extensions.includes('cs')) {
            return 'Game Development';
        }
        
        return 'General Project';
    }
    
    static detectStatus(fileNames, extensions) {
        // Production indicators
        if (fileNames.includes('dockerfile') || 
            fileNames.includes('docker-compose.yml') ||
            fileNames.some(name => name.includes('prod'))) {
            return 'Production';
        }
        
        // Development indicators
        if (fileNames.includes('dev') || 
            fileNames.includes('test') ||
            fileNames.some(name => name.includes('dev'))) {
            return 'Development';
        }
        
        return 'Development'; // Default
    }
    
    static generateTags(status, technologies, category) {
        const tags = [];
        
        if (status.toLowerCase() === 'production') tags.push('production');
        if (status.toLowerCase() === 'development') tags.push('development');
        
        if (technologies.includes('JavaScript') || technologies.includes('HTML')) tags.push('web');
        if (technologies.includes('Python') && (category.includes('AI') || category.includes('ML'))) tags.push('ai');
        if (category.includes('Web')) tags.push('web');
        if (technologies.includes('Docker')) tags.push('production');
        
        return tags;
    }
}

// API Routes
app.get('/api/projects', async (req, res) => {
    try {
        console.log('🔍 Scanning for projects...');
        const allProjects = [];
        
        for (const scanDir of scanDirectories) {
            try {
                // Check if the scanDir itself is a project directory (instead of scanning subdirectories)
                const stats = await fs.stat(scanDir);
                if (stats.isDirectory()) {
                    // Skip temp directories and other common exclusions
                    const dirName = path.basename(scanDir);
                    if (dirName.startsWith('$Temp') || 
                        dirName.endsWith('.tmp') ||
                        dirName === '$RECYCLE.BIN' || 
                        dirName === 'System Volume Information' ||
                        (dirName.startsWith('.') && dirName !== '.claude')) {
                        continue;
                    }
                    
                    const project = await ProjectAnalyzer.analyzeProject(scanDir, dirName);
                    
                    if (project) {
                        allProjects.push(project);
                    }
                }
            } catch (error) {
                console.warn(`Could not scan directory ${scanDir}:`, error.message);
            }
        }
        
        console.log(`✅ Found ${allProjects.length} projects`);
        res.json({
            success: true,
            projects: allProjects,
            scanTime: new Date().toISOString(),
            scannedDirectories: scanDirectories
        });
        
    } catch (error) {
        console.error('Error scanning projects:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Claude projects endpoint
app.get('/api/claude/projects', async (req, res) => {
    try {
        console.log('🤖 Scanning for Claude projects...');
        const allClaudeProjects = [];
        
        for (const scanDir of scanDirectories) {
            try {
                // Check if the scanDir itself is a Claude project directory (instead of scanning subdirectories)
                const stats = await fs.stat(scanDir);
                if (stats.isDirectory()) {
                    // Skip temp directories and other common exclusions
                    const dirName = path.basename(scanDir);
                    if (dirName.startsWith('$Temp') || 
                        dirName.endsWith('.tmp') ||
                        dirName === '$RECYCLE.BIN' || 
                        dirName === 'System Volume Information' ||
                        (dirName.startsWith('.') && dirName !== '.claude')) {
                        continue;
                    }
                    
                    const claudeProject = await ClaudeAnalyzer.analyzeClaudeProject(scanDir, dirName);
                    
                    if (claudeProject) {
                        allClaudeProjects.push(claudeProject);
                    }
                }
            } catch (error) {
                console.warn(`Could not scan directory ${scanDir} for Claude projects:`, error.message);
            }
        }
        
        console.log(`🤖 Found ${allClaudeProjects.length} Claude projects`);
        res.json({
            success: true,
            projects: allClaudeProjects,
            scanTime: new Date().toISOString(),
            scannedDirectories: scanDirectories
        });
        
    } catch (error) {
        console.error('Error scanning Claude projects:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Project Tracker Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Configuration endpoint
app.get('/api/config', (req, res) => {
    res.json({
        scanDirectories: scanDirectories,
        defaultDirectories: DEFAULT_SCAN_DIRECTORIES,
        port: PORT
    });
});

// Directory management endpoints
app.post('/api/directories', async (req, res) => {
    try {
        const { directory } = req.body;
        
        if (!directory || typeof directory !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Directory path is required and must be a string'
            });
        }
        
        // Check if directory already exists in the list
        if (scanDirectories.includes(directory)) {
            return res.status(400).json({
                success: false,
                error: 'Directory is already being scanned'
            });
        }
        
        // Validate that directory exists and is accessible
        try {
            await fs.access(directory);
            const stats = await fs.stat(directory);
            if (!stats.isDirectory()) {
                return res.status(400).json({
                    success: false,
                    error: 'Path exists but is not a directory'
                });
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Directory does not exist or is not accessible'
            });
        }
        
        // Add directory to scan list
        scanDirectories.push(directory);
        
        // Save to file
        await saveDirectoriesToFile();
        
        console.log(`✅ Added directory: ${directory}`);
        res.json({
            success: true,
            message: 'Directory added successfully',
            scanDirectories: scanDirectories
        });
        
    } catch (error) {
        console.error('Error adding directory:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.delete('/api/directories', async (req, res) => {
    try {
        const { directory } = req.body;
        
        if (!directory || typeof directory !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Directory path is required and must be a string'
            });
        }
        
        const index = scanDirectories.indexOf(directory);
        if (index === -1) {
            return res.status(400).json({
                success: false,
                error: 'Directory is not in the scan list'
            });
        }
        
        // Remove directory from scan list
        scanDirectories.splice(index, 1);
        
        // Save to file
        await saveDirectoriesToFile();
        
        console.log(`🗑️ Removed directory: ${directory}`);
        res.json({
            success: true,
            message: 'Directory removed successfully',
            scanDirectories: scanDirectories
        });
        
    } catch (error) {
        console.error('Error removing directory:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.put('/api/directories', async (req, res) => {
    try {
        const { directories } = req.body;
        
        if (!Array.isArray(directories)) {
            return res.status(400).json({
                success: false,
                error: 'Directories must be an array'
            });
        }
        
        // Validate all directories exist
        const validationPromises = directories.map(async (dir) => {
            try {
                await fs.access(dir);
                const stats = await fs.stat(dir);
                return { dir, valid: stats.isDirectory(), error: null };
            } catch (error) {
                return { dir, valid: false, error: error.message };
            }
        });
        
        const validationResults = await Promise.all(validationPromises);
        const invalidDirs = validationResults.filter(result => !result.valid);
        
        if (invalidDirs.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Some directories are invalid',
                invalidDirectories: invalidDirs
            });
        }
        
        // Update scan directories
        scanDirectories = [...directories];
        
        // Save to file
        await saveDirectoriesToFile();
        
        console.log(`🔄 Updated directories: ${scanDirectories.length} total`);
        res.json({
            success: true,
            message: 'Directories updated successfully',
            scanDirectories: scanDirectories
        });
        
    } catch (error) {
        console.error('Error updating directories:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Initialize and start server
async function startServer() {
    // Load directories from file on startup
    await loadDirectoriesFromFile();
    
    app.listen(PORT, () => {
        console.log(`🚀 Project Tracker Backend running on http://localhost:${PORT}`);
        console.log(`📂 Scanning directories: ${scanDirectories.length} configured`);
        console.log(`🔍 Access projects API at: http://localhost:${PORT}/api/projects`);
    });
}

// Start the server
startServer().catch(console.error);

module.exports = app;