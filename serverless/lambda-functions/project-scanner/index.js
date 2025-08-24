const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const { httpMethod, path: requestPath } = event;
        
        // Handle OPTIONS requests for CORS
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: ''
            };
        }
        
        let result;
        const isCachedRequest = requestPath === '/api/projects/cached';
        
        if (isCachedRequest) {
            // Try to get from cache first
            result = await getCachedProjects();
            if (!result || result.length === 0) {
                // If no cache, scan and return
                result = await scanAndCacheProjects();
            }
        } else {
            // Full scan - always fresh data
            result = await scanAndCacheProjects();
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            },
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        console.error('Error:', error);
        
        return {
            statusCode: error.statusCode || 500,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            },
            body: JSON.stringify({
                error: error.message || 'Internal server error'
            })
        };
    }
};

async function getCachedProjects() {
    try {
        const params = {
            TableName: process.env.PROJECTS_TABLE
        };
        
        const result = await dynamoDb.scan(params).promise();
        
        // Filter out expired items (TTL should handle this, but extra safety)
        const now = Math.floor(Date.now() / 1000);
        const validProjects = result.Items.filter(item => !item.ttl || item.ttl > now);
        
        return validProjects.map(item => ({
            ...item,
            // Remove DynamoDB internal fields
            ttl: undefined
        }));
    } catch (error) {
        console.error('Error getting cached projects:', error);
        return [];
    }
}

async function scanAndCacheProjects() {
    console.log('Starting project scan...');
    
    // Get directories from config
    const directories = await getDirectories();
    const projects = [];
    
    for (const directory of directories) {
        try {
            const projectData = await ProjectAnalyzer.analyzeProject(directory);
            if (projectData) {
                projects.push(projectData);
                
                // Cache in DynamoDB with 24-hour TTL
                await cacheProject(projectData);
            }
        } catch (error) {
            console.error(`Error analyzing project ${directory}:`, error.message);
            // Continue with other projects
        }
    }
    
    console.log(`✅ Found ${projects.length} projects`);
    return projects;
}

async function getDirectories() {
    try {
        // Get directories from config table
        const params = {
            TableName: process.env.CONFIG_TABLE,
            Key: { configKey: 'directories' }
        };
        
        const result = await dynamoDb.get(params).promise();
        
        if (result.Item && result.Item.directories) {
            return result.Item.directories;
        } else {
            // Default directories if no config found
            return [
                '/mnt/f/utility-projects/project-tracker',
                '/mnt/f/utility-projects/fundo-matic'
            ];
        }
    } catch (error) {
        console.error('Error getting directories:', error);
        return [];
    }
}

async function cacheProject(projectData) {
    try {
        const params = {
            TableName: process.env.PROJECTS_TABLE,
            Item: {
                ...projectData,
                ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
                lastCached: new Date().toISOString()
            }
        };
        
        await dynamoDb.put(params).promise();
    } catch (error) {
        console.error('Error caching project:', error);
        // Don't throw - caching is optional
    }
}

// Project Analysis Logic (extracted from server.js)
class ProjectAnalyzer {
    static async analyzeProject(projectPath) {
        try {
            const projectName = path.basename(projectPath);
            const files = await this.getFilesRecursively(projectPath);
            const fileNames = files.map(f => path.basename(f).toLowerCase());
            const extensions = files.map(f => path.extname(f).toLowerCase().slice(1)).filter(ext => ext);
            
            // Auto-detect features
            const hasReadme = fileNames.some(name => name.startsWith('readme'));
            const hasClaude = fileNames.includes('claude.md');
            const hasVenv = await this.detectVirtualEnv(projectPath, files);
            
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
            
            try {
                if (await this.fileExists(gitPath)) {
                    const remoteUrl = await this.getRemoteUrl(projectPath);
                    if (this.isGitHubRepo(remoteUrl)) {
                        isGitHub = true;
                        gitHubUrl = remoteUrl
                            .replace('git@github.com:', 'https://github.com/')
                            .replace('.git', '');
                    }
                    
                    // Get last commit date
                    const lastCommit = await this.getLastCommit(projectPath);
                    if (lastCommit && lastCommit.date) {
                        lastCommitDate = lastCommit.date;
                    }
                }
            } catch (gitError) {
                console.log(`Git analysis failed for ${projectPath}: ${gitError.message}`);
            }
            
            // Generate tags
            const tags = this.generateTags(status, technologies, category, projectName, projectPath);
            
            return {
                projectPath,
                name: projectName,
                path: projectPath,
                description: `${category} project with ${technologies}`,
                lastModified,
                files: technologies,
                hasReadme,
                hasClaude,
                hasVenv,
                hasClaudeFile: hasClaude,
                hasClaudeDir: false, // Simplified for Lambda
                claudeRole: null,
                permissions: [],
                isGitHub,
                gitHubUrl,
                lastCommitDate,
                type: category,
                status,
                tags,
                lastAnalyzed: new Date().toISOString()
            };
        } catch (error) {
            console.error(`Error analyzing project ${projectPath}:`, error);
            throw error;
        }
    }
    
    static async getFilesRecursively(dirPath, maxDepth = 3, currentDepth = 0) {
        if (currentDepth >= maxDepth) return [];
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const files = [];
            
            for (const entry of entries) {
                // Skip common directories that don't need analysis
                if (entry.isDirectory() && 
                    ['node_modules', '.git', '__pycache__', 'venv', '.venv', 'env', 'build', 'dist'].includes(entry.name)) {
                    continue;
                }
                
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isFile()) {
                    files.push(fullPath);
                } else if (entry.isDirectory()) {
                    const subFiles = await this.getFilesRecursively(fullPath, maxDepth, currentDepth + 1);
                    files.push(...subFiles);
                }
            }
            
            return files;
        } catch (error) {
            return [];
        }
    }
    
    static async detectVirtualEnv(projectPath, files) {
        try {
            const entries = await fs.readdir(projectPath);
            const hasVenvDir = entries.some(entry => 
                entry === 'venv' || entry === '.venv' || entry === 'env'
            );
            
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
        if (name.includes('game') || name.includes('unity')) {
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
        
        // Framework tags
        if (technologies.includes('React') || technologies.includes('Vue.js')) tags.add('frontend');
        if (technologies.includes('Node.js') || technologies.includes('Python')) tags.add('backend');
        
        // Tool tags
        if (technologies.includes('Docker')) tags.add('tool');
        
        return Array.from(tags);
    }
    
    // Git helper methods (simplified)
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    static async getRemoteUrl(projectPath) {
        try {
            const result = execSync('git remote get-url origin', { 
                cwd: projectPath, 
                encoding: 'utf8',
                timeout: 10000
            });
            return result.trim();
        } catch {
            return null;
        }
    }
    
    static isGitHubRepo(remoteUrl) {
        return remoteUrl && (remoteUrl.includes('github.com'));
    }
    
    static async getLastCommit(projectPath) {
        try {
            const result = execSync('git log -1 --format="%H|%s|%an|%ar"', { 
                cwd: projectPath, 
                encoding: 'utf8',
                timeout: 10000
            });
            
            const [hash, message, author, date] = result.trim().split('|');
            return { hash, message, author, date };
        } catch {
            return null;
        }
    }
}