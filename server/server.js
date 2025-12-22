const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

// Enable CORS for frontend access
app.use(cors());
app.use(express.json());

// Configuration - individual project directories to scan
// NOTE: Each directory should be a specific project directory, not a parent containing multiple projects
// Add your project directories via the web UI or by editing directories.json
const DEFAULT_SCAN_DIRECTORIES = [];

// Dynamic scan directories (can be modified at runtime)
let scanDirectories = [...DEFAULT_SCAN_DIRECTORIES];

// Persistence functions
const DIRECTORIES_CONFIG_FILE = path.join(__dirname, 'directories.json');
const USER_DATA_FILE = path.join(__dirname, 'user-data.json');

// User data (tags and favorites) persistence
let userData = {
    tags: {},      // { projectPath: ['tag1', 'tag2'] }
    favorites: []  // [projectPath1, projectPath2]
};

async function loadUserData() {
    try {
        const data = await fs.readFile(USER_DATA_FILE, 'utf8');
        const loaded = JSON.parse(data);
        userData = {
            tags: loaded.tags || {},
            favorites: loaded.favorites || []
        };
        console.log(`👤 Loaded user data: ${Object.keys(userData.tags).length} projects with custom tags, ${userData.favorites.length} favorites`);
    } catch (error) {
        console.log(`👤 No user data file found, starting fresh`);
    }
}

async function saveUserData() {
    try {
        await fs.writeFile(USER_DATA_FILE, JSON.stringify(userData, null, 2));
        console.log(`💾 Saved user data`);
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

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

// Cache management for project data
const PROJECTS_CACHE_FILE = path.join(__dirname, 'projects-cache.json');
const CACHE_VERSION = '1.0.0';
const CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour default cache validity

class CacheManager {
    static cache = {
        version: CACHE_VERSION,
        timestamp: null,
        projects: [],
        claudeProjects: [],
        gitRepos: [],
        tags: new Set()
    };

    static isScanning = false;
    static lastScanRequest = null;

    static async loadCache() {
        try {
            const data = await fs.readFile(PROJECTS_CACHE_FILE, 'utf8');
            const loaded = JSON.parse(data);
            
            // Validate cache version
            if (loaded.version === CACHE_VERSION) {
                this.cache = loaded;
                // Convert tags array back to Set
                this.cache.tags = new Set(loaded.tags || []);
                console.log(`📦 Loaded cache with ${this.cache.projects.length} projects (age: ${this.getCacheAge()}ms)`);
                return true;
            }
        } catch (error) {
            console.log('📦 No valid cache found, will scan on first request');
        }
        return false;
    }

    static async saveCache() {
        try {
            const toSave = {
                ...this.cache,
                tags: Array.from(this.cache.tags), // Convert Set to array for JSON
                timestamp: Date.now()
            };
            await fs.writeFile(PROJECTS_CACHE_FILE, JSON.stringify(toSave, null, 2));
            console.log(`💾 Saved cache with ${this.cache.projects.length} projects`);
        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }

    static getCacheAge() {
        if (!this.cache.timestamp) return Infinity;
        return Date.now() - this.cache.timestamp;
    }

    static isCacheValid(maxAge = CACHE_MAX_AGE) {
        return this.cache.projects.length > 0 && this.getCacheAge() < maxAge;
    }

    static async updateProjectsCache(projects) {
        this.cache.projects = projects;
        this.cache.timestamp = Date.now();
        
        // Update tags from all projects
        this.cache.tags = new Set();
        projects.forEach(project => {
            if (project.tags && Array.isArray(project.tags)) {
                project.tags.forEach(tag => this.cache.tags.add(tag));
            }
        });

        await this.saveCache();
    }

    static async updateClaudeCache(claudeProjects) {
        this.cache.claudeProjects = claudeProjects;
        await this.saveCache();
    }

    static async updateGitCache(gitRepos) {
        this.cache.gitRepos = gitRepos;
        await this.saveCache();
    }

    static async invalidateCache() {
        this.cache = {
            version: CACHE_VERSION,
            timestamp: null,
            projects: [],
            claudeProjects: [],
            gitRepos: [],
            tags: new Set()
        };
        try {
            await fs.unlink(PROJECTS_CACHE_FILE);
            console.log('🗑️ Cache invalidated');
        } catch (error) {
            // File might not exist
        }
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
            
            // Claude Code detection removed - not feasible
            
            // Determine status
            const status = this.determineClaudeStatus(hasClaudeFile, hasClaudeDir, lastActivity);
            
            return {
                name: claudeName,
                path: projectPath,
                claudeRole: claudeRole,
                hasClaudeFile: hasClaudeFile,
                hasClaudeDir: hasClaudeDir,
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
    
    // Local Claude detection removed - not feasible
    
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
            
            // Local Claude detection removed - not feasible
            
            // Detect technologies and category
            const technologies = this.detectTechnologies(extensions, fileNames);
            const category = this.detectCategory(extensions, fileNames, projectName);
            const status = this.detectStatus(fileNames, extensions);
            
            // Get last modified date
            const stats = await fs.stat(projectPath);
            const lastModified = stats.mtime.getFullYear().toString();
            
            // Check for GitHub repository and last commit
            const gitPath = path.join(projectPath, '.git');
            let gitHubUrl = null;
            let isGitHub = false;
            let lastCommitDate = null;
            let githubActions = null;
            let localVsRemote = null;
            try {
                if (await ProjectAnalyzer.fileExists(gitPath)) {
                    const remoteUrl = await GitAnalyzer.getRemoteUrl(projectPath);
                    if (GitAnalyzer.isGitHubRepo(remoteUrl)) {
                        isGitHub = true;
                        gitHubUrl = remoteUrl
                            .replace('git@github.com:', 'https://github.com/')
                            .replace('.git', '');
                        
                        // Get GitHub Actions CI/CD status
                        githubActions = await GitAnalyzer.getGitHubActions(projectPath);
                    }
                    // Get last commit date for all git repos
                    const lastCommit = await GitAnalyzer.getLastCommit(projectPath);
                    if (lastCommit && lastCommit.date) {
                        lastCommitDate = lastCommit.date;
                    }
                    
                    // Get local vs remote sync status
                    const workingTreeStatus = await GitAnalyzer.getWorkingTreeStatus(projectPath);
                    const branchStatus = await GitAnalyzer.getBranchStatus(projectPath);
                    
                    localVsRemote = {
                        isSynced: workingTreeStatus.isClean && branchStatus.isSynced,
                        hasUncommittedChanges: !workingTreeStatus.isClean,
                        aheadCount: branchStatus.aheadCount || 0,
                        behindCount: branchStatus.behindCount || 0,
                        description: branchStatus.description || 'Unknown status'
                    };
                }
            } catch (error) {
                // Ignore git errors, project just won't have GitHub info
            }
            
            // Merge auto-generated tags with user-saved tags
            const autoTags = this.generateTags(status, technologies, category, projectName, projectPath);
            const userTags = userData.tags[projectPath] || [];
            const mergedTags = [...new Set([...autoTags, ...userTags])];
            
            return {
                name: projectName,
                path: projectPath,
                description: projectName,
                status: status,
                technologies: technologies,
                category: category,
                tags: mergedTags,
                userTags: userTags,  // Send user tags separately so frontend knows which are custom
                hasReadme: hasReadme,
                hasClaude: hasClaude,
                hasVenv: hasVenv,
                isGitHub: isGitHub,
                gitHubUrl: gitHubUrl,
                lastCommitDate: lastCommitDate,
                githubActions: githubActions,
                localVsRemote: localVsRemote,
                lastUpdated: lastModified,
                isFavorite: userData.favorites.includes(projectPath),
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
    
    static generateTags(status, technologies, category, projectName = '', projectPath = '') {
        const tags = new Set();
        
        // Status-based tags
        if (status.toLowerCase() === 'production') tags.add('production');
        if (status.toLowerCase() === 'development') tags.add('development');
        
        // Technology-based tags
        if (technologies.includes('JavaScript') || technologies.includes('HTML')) tags.add('web');
        if (technologies.includes('React')) tags.add('frontend');
        if (technologies.includes('Node.js')) tags.add('backend');
        if (technologies.includes('Python') && (category.includes('AI') || category.includes('ML'))) tags.add('ai');
        if (technologies.includes('Python') && !tags.has('ai')) tags.add('backend');
        if (category.includes('Web')) tags.add('web');
        if (technologies.includes('Docker')) tags.add('production');
        
        // Project name-based tags (quantum, research, etc.)
        const nameLower = projectName.toLowerCase();
        const pathLower = projectPath.toLowerCase();
        
        // Quantum computing projects
        if (nameLower.includes('quantum') || nameLower.includes('q-art') || nameLower.includes('qsim') || 
            nameLower.includes('photon') || pathLower.includes('quantum')) {
            tags.add('quantum');
        }
        
        // AI/ML projects
        if (nameLower.includes('ai') || nameLower.includes('ml') || nameLower.includes('neural') ||
            nameLower.includes('machine') || nameLower.includes('learning') || 
            category.includes('AI') || category.includes('ML')) {
            tags.add('ai');
        }
        
        // Research projects
        if (nameLower.includes('research') || nameLower.includes('analysis') || 
            nameLower.includes('study') || pathLower.includes('science') ||
            pathLower.includes('consciousness') || nameLower.includes('experiment')) {
            tags.add('research');
        }
        
        // Creative/Art projects
        if (nameLower.includes('art') || nameLower.includes('creative') || 
            nameLower.includes('haiku') || nameLower.includes('curator') ||
            pathLower.includes('art-projects')) {
            tags.add('creative');
        }
        
        // Game projects
        if (nameLower.includes('game') || nameLower.includes('gaming') ||
            pathLower.includes('game')) {
            tags.add('gaming');
        }
        
        // Tool/Utility projects
        if (pathLower.includes('utility') || nameLower.includes('tool') ||
            nameLower.includes('tracker') || nameLower.includes('analyzer') ||
            nameLower.includes('counter') || nameLower.includes('finder')) {
            tags.add('tool');
        }
        
        // Science projects
        if (pathLower.includes('science') || nameLower.includes('physics') ||
            nameLower.includes('neutrino') || nameLower.includes('topology') ||
            nameLower.includes('icecube') || nameLower.includes('prover')) {
            tags.add('science');
        }
        
        // Environmental projects
        if (pathLower.includes('environmental') || nameLower.includes('runoff') ||
            nameLower.includes('eco') || nameLower.includes('climate')) {
            tags.add('environmental');
        }
        
        // Security projects
        if (nameLower.includes('security') || nameLower.includes('captcha') ||
            nameLower.includes('auth') || nameLower.includes('guard')) {
            tags.add('security');
        }
        
        // Business/Commercial projects
        if (nameLower.includes('business') || nameLower.includes('commercial') ||
            nameLower.includes('shop') || nameLower.includes('.com')) {
            tags.add('business');
        }
        
        // Education projects
        if (nameLower.includes('education') || nameLower.includes('tutorial') ||
            nameLower.includes('cs102') || nameLower.includes('learn')) {
            tags.add('education');
        }
        
        // Experimental projects
        if (pathLower.includes('experimental') || nameLower.includes('experiment') ||
            nameLower.includes('prototype') || nameLower.includes('test')) {
            tags.add('experimental');
        }
        
        // Architecture/Framework projects
        if (nameLower.includes('architecture') || nameLower.includes('framework') ||
            nameLower.includes('template') || nameLower.includes('platform')) {
            tags.add('framework');
        }
        
        // Data/Analytics projects
        if (nameLower.includes('data') || nameLower.includes('analytics') ||
            nameLower.includes('retrieval') || nameLower.includes('analysis')) {
            tags.add('data');
        }
        
        return Array.from(tags);
    }
    
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

// Git repository analysis functions
class GitAnalyzer {
    static async analyzeGitRepo(projectPath, projectName) {
        try {
            // Check if it's a git repository
            const gitPath = path.join(projectPath, '.git');
            if (!await this.fileExists(gitPath)) {
                return null; // Not a git repository
            }
            
            // Get basic git information
            const currentBranch = await this.getCurrentBranch(projectPath);
            const remoteUrl = await this.getRemoteUrl(projectPath);
            const isGitHub = this.isGitHubRepo(remoteUrl);
            const lastCommit = await this.getLastCommit(projectPath);
            const branchStatus = await this.getBranchStatus(projectPath);
            const workingTreeStatus = await this.getWorkingTreeStatus(projectPath);
            const hasGitignore = await this.fileExists(path.join(projectPath, '.gitignore'));
            const totalBranches = await this.getBranchCount(projectPath);
            const lastActivity = await this.getLastActivity(projectPath);
            
            // Get GitHub-specific information if applicable
            let githubActions = null;
            if (isGitHub) {
                githubActions = await this.getGitHubActions(projectPath);
            }
            
            return {
                name: projectName,
                path: projectPath,
                isGitRepo: true,
                currentBranch: currentBranch,
                remoteUrl: remoteUrl,
                isGitHub: isGitHub,
                hasGitignore: hasGitignore,
                lastCommit: lastCommit,
                branchStatus: branchStatus.description,
                aheadCount: branchStatus.ahead,
                behindCount: branchStatus.behind,
                workingTreeClean: workingTreeStatus.isClean,
                uncommittedChanges: workingTreeStatus.modified,
                untrackedFiles: workingTreeStatus.untracked,
                totalBranches: totalBranches,
                lastActivity: lastActivity,
                githubActions: githubActions,
                dateScanned: new Date().toISOString()
            };
        } catch (error) {
            console.warn(`Error analyzing git repo ${projectName}:`, error.message);
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
    
    static async executeGitCommand(projectPath, command) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            const fullCommand = `cd "${projectPath}" && git ${command}`;
            
            exec(fullCommand, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    // Git commands often return non-zero exit codes for normal conditions
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim(), error });
                } else {
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim(), error: null });
                }
            });
        });
    }
    
    static async getCurrentBranch(projectPath) {
        try {
            const result = await this.executeGitCommand(projectPath, 'branch --show-current');
            return result.stdout || 'detached HEAD';
        } catch {
            return null;
        }
    }
    
    static async getRemoteUrl(projectPath) {
        try {
            const result = await this.executeGitCommand(projectPath, 'remote get-url origin');
            return result.stdout || null;
        } catch {
            return null;
        }
    }
    
    static isGitHubRepo(remoteUrl) {
        if (!remoteUrl) return false;
        return remoteUrl.includes('github.com');
    }
    
    static async getLastCommit(projectPath) {
        try {
            const result = await this.executeGitCommand(projectPath, 'log -1 --pretty=format:"%H|%s|%an|%ar"');
            if (!result.stdout) return null;
            
            const [hash, message, author, date] = result.stdout.replace(/"/g, '').split('|');
            return {
                hash: hash ? hash.substring(0, 8) : 'unknown',
                message: message || 'No commit message',
                author: author || 'Unknown',
                date: date || 'Unknown'
            };
        } catch {
            return null;
        }
    }
    
    static async getBranchStatus(projectPath) {
        try {
            const result = await this.executeGitCommand(projectPath, 'status -b --porcelain=v1');
            const lines = result.stdout.split('\n');
            const branchLine = lines[0];
            
            let ahead = 0;
            let behind = 0;
            let description = 'Unknown';
            
            if (branchLine) {
                const aheadMatch = branchLine.match(/ahead (\d+)/);
                const behindMatch = branchLine.match(/behind (\d+)/);
                
                if (aheadMatch) ahead = parseInt(aheadMatch[1]);
                if (behindMatch) behind = parseInt(behindMatch[1]);
                
                if (ahead > 0 && behind > 0) {
                    description = `${ahead} ahead, ${behind} behind`;
                } else if (ahead > 0) {
                    description = `${ahead} ahead`;
                } else if (behind > 0) {
                    description = `${behind} behind`;
                } else if (branchLine.includes('...')) {
                    description = 'Up to date';
                } else {
                    description = 'No upstream';
                }
            }
            
            // Calculate if synced (no commits ahead or behind)
            const isSynced = ahead === 0 && behind === 0;
            
            return { 
                ahead, 
                behind, 
                aheadCount: ahead,    // Add alias for frontend compatibility
                behindCount: behind,  // Add alias for frontend compatibility
                isSynced,             // Add computed sync status
                description 
            };
        } catch {
            return { 
                ahead: 0, 
                behind: 0, 
                aheadCount: 0,
                behindCount: 0,
                isSynced: false,
                description: 'Git command failed' 
            };
        }
    }
    
    static async getWorkingTreeStatus(projectPath) {
        try {
            const result = await this.executeGitCommand(projectPath, 'status --porcelain');
            const lines = result.stdout.split('\n').filter(line => line.trim());
            
            let modified = 0;
            let untracked = 0;
            
            for (const line of lines) {
                if (line.startsWith('??')) {
                    untracked++;
                } else {
                    modified++;
                }
            }
            
            return {
                isClean: lines.length === 0,
                modified: modified,
                untracked: untracked
            };
        } catch {
            return { isClean: null, modified: 0, untracked: 0 };
        }
    }
    
    static async getBranchCount(projectPath) {
        try {
            const result = await this.executeGitCommand(projectPath, 'branch -a');
            const branches = result.stdout.split('\n').filter(line => line.trim());
            return branches.length;
        } catch {
            return 0;
        }
    }
    
    static async getLastActivity(projectPath) {
        try {
            const result = await this.executeGitCommand(projectPath, 'log -1 --pretty=format:"%cr"');
            return result.stdout.replace(/"/g, '') || 'Unknown';
        } catch {
            return 'Unknown';
        }
    }
    
    static async getGitHubActions(projectPath) {
        try {
            // Check if GitHub CLI is available and we can get workflow status
            const { exec } = require('child_process');
            return new Promise((resolve) => {
                const command = `cd "${projectPath}" && gh run list --limit 1 --json status,workflowName,createdAt 2>/dev/null`;
                
                exec(command, { timeout: 5000 }, (error, stdout) => {
                    if (error || !stdout.trim()) {
                        resolve(null);
                        return;
                    }
                    
                    try {
                        const runs = JSON.parse(stdout);
                        if (runs && runs.length > 0) {
                            const lastRun = runs[0];
                            return resolve({
                                status: lastRun.status === 'completed' ? 'success' : lastRun.status,
                                workflowName: lastRun.workflowName,
                                lastRun: this.formatDate(lastRun.createdAt)
                            });
                        }
                    } catch (parseError) {
                        // Invalid JSON response
                    }
                    
                    resolve(null);
                });
            });
        } catch {
            return null;
        }
    }
    
    static formatDate(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            
            return date.toLocaleDateString();
        } catch {
            return 'Unknown';
        }
    }
}

// API Routes

// Fast cached endpoint - returns immediately with cached data
app.get('/api/projects/cached', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        
        // Return cached data if valid
        if (!forceRefresh && CacheManager.isCacheValid()) {
            console.log('📦 Returning cached projects');
            return res.json({
                success: true,
                projects: CacheManager.cache.projects,
                fromCache: true,
                cacheAge: CacheManager.getCacheAge(),
                scanTime: new Date(CacheManager.cache.timestamp).toISOString(),
                scannedDirectories: scanDirectories
            });
        }

        // If no cache or force refresh, trigger background scan
        if (!CacheManager.isScanning) {
            CacheManager.isScanning = true;
            console.log('🔄 Starting background scan...');
            
            // Don't await - let it run in background
            scanProjectsInBackground().then(() => {
                CacheManager.isScanning = false;
            }).catch(error => {
                console.error('Background scan error:', error);
                CacheManager.isScanning = false;
            });
        }

        // Return existing cache (even if stale) or empty array
        res.json({
            success: true,
            projects: CacheManager.cache.projects || [],
            fromCache: true,
            scanning: true,
            cacheAge: CacheManager.getCacheAge(),
            scanTime: CacheManager.cache.timestamp ? new Date(CacheManager.cache.timestamp).toISOString() : null,
            scannedDirectories: scanDirectories
        });

    } catch (error) {
        console.error('Error with cached projects:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Background scanning function
async function scanProjectsInBackground() {
    console.log('🔍 Background scan starting...');
    const allProjects = [];
    
    for (const scanDir of scanDirectories) {
        try {
            const stats = await fs.stat(scanDir);
            if (stats.isDirectory()) {
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
    
    await CacheManager.updateProjectsCache(allProjects);
    console.log(`✅ Background scan complete: ${allProjects.length} projects cached`);
    return allProjects;
}

// Original endpoint - now uses cache but waits for fresh scan
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
        
        // Update cache with fresh data
        await CacheManager.updateProjectsCache(allProjects);
        
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
        let { directory } = req.body;
        
        if (!directory || typeof directory !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Directory path is required and must be a string'
            });
        }
        
        // Normalize path for cross-platform compatibility
        directory = directory.trim();
        
        // Handle Windows paths in WSL environment
        if (process.platform === 'linux') {
            // Check if it's a Windows path (C:\ or C:/)
            const windowsDriveMatch = directory.match(/^([A-Za-z]):[\\\/]/);
            if (windowsDriveMatch) {
                // Convert Windows path to WSL path
                const driveLetter = windowsDriveMatch[1].toLowerCase();
                const pathWithoutDrive = directory.substring(2).replace(/\\/g, '/');
                directory = `/mnt/${driveLetter}${pathWithoutDrive}`;
            }
        }
        
        // Handle tilde expansion for home directory
        if (directory.startsWith('~/')) {
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            directory = path.join(homeDir, directory.substring(2));
        }
        
        // Now resolve to absolute path
        directory = path.resolve(directory);
        
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
        
        // Invalidate cache when directories change
        await CacheManager.invalidateCache();
        
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
        
        // Invalidate cache when directories change
        await CacheManager.invalidateCache();
        
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
        
        // Invalidate cache when directories change
        await CacheManager.invalidateCache();
        
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

// Git repositories endpoint
app.get('/api/git/repos', async (req, res) => {
    try {
        console.log('🔀 Scanning for git repositories...');
        const allGitRepos = [];
        
        for (const scanDir of scanDirectories) {
            try {
                // Check if the scanDir itself is a git repository
                const stats = await fs.stat(scanDir);
                if (stats.isDirectory()) {
                    // Skip temp directories and other common exclusions
                    const dirName = path.basename(scanDir);
                    if (dirName.startsWith('$Temp') || 
                        dirName.endsWith('.tmp') ||
                        dirName === '$RECYCLE.BIN' || 
                        dirName === 'System Volume Information') {
                        continue;
                    }
                    
                    const gitRepo = await GitAnalyzer.analyzeGitRepo(scanDir, dirName);
                    
                    if (gitRepo) {
                        allGitRepos.push(gitRepo);
                    }
                }
            } catch (error) {
                console.warn(`Could not scan directory ${scanDir} for git repos:`, error.message);
            }
        }
        
        console.log(`🔀 Found ${allGitRepos.length} git repositories`);
        res.json({
            success: true,
            repositories: allGitRepos,
            scanTime: new Date().toISOString(),
            scannedDirectories: scanDirectories
        });
        
    } catch (error) {
        console.error('Error scanning git repositories:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Tag management endpoints
app.get('/api/tags', async (req, res) => {
    try {
        console.log('🏷️ Getting all tags...');
        const allTags = new Set();
        
        for (const scanDir of scanDirectories) {
            try {
                const stats = await fs.stat(scanDir);
                if (stats.isDirectory()) {
                    const dirName = path.basename(scanDir);
                    if (dirName.startsWith('$Temp') || 
                        dirName.endsWith('.tmp') ||
                        dirName === '$RECYCLE.BIN' || 
                        dirName === 'System Volume Information' ||
                        (dirName.startsWith('.') && dirName !== '.claude')) {
                        continue;
                    }
                    
                    const project = await ProjectAnalyzer.analyzeProject(scanDir, dirName);
                    if (project && project.tags) {
                        project.tags.forEach(tag => allTags.add(tag));
                    }
                }
            } catch (error) {
                console.warn(`Could not scan directory ${scanDir} for tags:`, error.message);
            }
        }
        
        console.log(`🏷️ Found ${allTags.size} unique tags`);
        res.json({
            success: true,
            tags: Array.from(allTags).sort(),
            scanTime: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting tags:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/projects/:projectPath/tags', async (req, res) => {
    try {
        const { projectPath } = req.params;
        const { tags } = req.body;
        
        if (!Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                error: 'Tags must be an array'
            });
        }
        
        // Decode the project path
        const decodedPath = decodeURIComponent(projectPath);
        
        // Validate that directory exists
        try {
            await fs.access(decodedPath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'Project directory not found'
            });
        }
        
        // Save tags to user data file
        userData.tags[decodedPath] = tags;
        await saveUserData();
        
        console.log(`🏷️ Saved tags for ${decodedPath}: ${tags.join(', ')}`);
        
        res.json({
            success: true,
            message: 'Tags saved successfully',
            projectPath: decodedPath,
            tags: tags
        });
        
    } catch (error) {
        console.error('Error updating project tags:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get tags for a specific project
app.get('/api/projects/:projectPath/tags', async (req, res) => {
    try {
        const { projectPath } = req.params;
        const decodedPath = decodeURIComponent(projectPath);
        
        const tags = userData.tags[decodedPath] || [];
        
        res.json({
            success: true,
            projectPath: decodedPath,
            tags: tags
        });
        
    } catch (error) {
        console.error('Error getting project tags:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Favorites endpoints
app.get('/api/favorites', (req, res) => {
    res.json({
        success: true,
        favorites: userData.favorites
    });
});

app.post('/api/favorites', async (req, res) => {
    try {
        const { projectPath } = req.body;
        
        if (!projectPath || typeof projectPath !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Project path is required'
            });
        }
        
        if (!userData.favorites.includes(projectPath)) {
            userData.favorites.push(projectPath);
            await saveUserData();
            console.log(`⭐ Added favorite: ${projectPath}`);
        }
        
        res.json({
            success: true,
            message: 'Favorite added',
            favorites: userData.favorites
        });
        
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.delete('/api/favorites', async (req, res) => {
    try {
        const { projectPath } = req.body;
        
        if (!projectPath || typeof projectPath !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Project path is required'
            });
        }
        
        const index = userData.favorites.indexOf(projectPath);
        if (index > -1) {
            userData.favorites.splice(index, 1);
            await saveUserData();
            console.log(`⭐ Removed favorite: ${projectPath}`);
        }
        
        res.json({
            success: true,
            message: 'Favorite removed',
            favorites: userData.favorites
        });
        
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.delete('/api/tags/:tagName', async (req, res) => {
    try {
        const { tagName } = req.params;
        
        console.log(`🗑️ Removing tag: ${tagName}`);
        
        // Here you would typically remove the tag from all projects in a database
        // For now, we'll just return success since tags are managed client-side
        
        res.json({
            success: true,
            message: `Tag "${tagName}" removed successfully`
        });
        
    } catch (error) {
        console.error('Error removing tag:', error);
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
    
    // Load user data (tags, favorites) on startup
    await loadUserData();
    
    // Load cache from file on startup
    await CacheManager.loadCache();
    
    app.listen(PORT, HOST, () => {
        console.log(`🚀 Project Tracker Backend running on http://${HOST}:${PORT}`);
        console.log(`📂 Scanning directories: ${scanDirectories.length} configured`);
        console.log(`📦 Cache: ${CacheManager.cache.projects.length} projects loaded`);
        console.log(`👤 User data: ${Object.keys(userData.tags).length} projects with tags, ${userData.favorites.length} favorites`);
    });
}

// Start the server
startServer().catch(console.error);

module.exports = app;