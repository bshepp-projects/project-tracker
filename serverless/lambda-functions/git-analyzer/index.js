const AWS = require('aws-sdk');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const { httpMethod } = event;
        
        // Handle OPTIONS requests for CORS
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: ''
            };
        }
        
        // Get all projects and analyze their git repositories
        const repositories = await getGitRepositories();
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            },
            body: JSON.stringify(repositories)
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

async function getGitRepositories() {
    try {
        // Get all cached projects
        const params = {
            TableName: process.env.PROJECTS_TABLE
        };
        
        const result = await dynamoDb.scan(params).promise();
        const repositories = [];
        
        for (const project of result.Items) {
            try {
                const gitInfo = await analyzeGitRepository(project.projectPath);
                if (gitInfo) {
                    repositories.push({
                        ...project,
                        ...gitInfo
                    });
                }
            } catch (error) {
                console.error(`Git analysis failed for ${project.projectPath}:`, error.message);
                // Continue with other repositories
            }
        }
        
        return repositories;
    } catch (error) {
        console.error('Error getting git repositories:', error);
        return [];
    }
}

async function analyzeGitRepository(projectPath) {
    try {
        const gitPath = path.join(projectPath, '.git');
        
        // Check if it's a git repository
        try {
            await fs.access(gitPath);
        } catch {
            return null; // Not a git repository
        }
        
        // Get basic git information
        const repoInfo = {
            isGitRepo: true,
            currentBranch: null,
            lastCommit: null,
            remoteUrl: null,
            isGitHub: false,
            gitHubUrl: null,
            ahead: 0,
            behind: 0,
            isClean: true,
            uncommittedChanges: 0,
            untrackedFiles: 0,
            totalBranches: 0
        };
        
        try {
            // Get current branch
            const branchResult = execSync('git rev-parse --abbrev-ref HEAD', { 
                cwd: projectPath, 
                encoding: 'utf8',
                timeout: 10000
            });
            repoInfo.currentBranch = branchResult.trim();
        } catch (error) {
            console.log('Could not get current branch:', error.message);
        }
        
        try {
            // Get last commit info
            const lastCommitResult = execSync('git log -1 --format="%H|%s|%an|%ar|%ad"', { 
                cwd: projectPath, 
                encoding: 'utf8',
                timeout: 10000
            });
            
            const [hash, message, author, relativeDate, absoluteDate] = lastCommitResult.trim().split('|');
            repoInfo.lastCommit = {
                hash: hash.substring(0, 8),
                message,
                author,
                date: relativeDate,
                absoluteDate
            };
        } catch (error) {
            console.log('Could not get last commit:', error.message);
        }
        
        try {
            // Get remote URL
            const remoteResult = execSync('git remote get-url origin', { 
                cwd: projectPath, 
                encoding: 'utf8',
                timeout: 10000
            });
            repoInfo.remoteUrl = remoteResult.trim();
            
            // Check if it's GitHub
            if (repoInfo.remoteUrl && repoInfo.remoteUrl.includes('github.com')) {
                repoInfo.isGitHub = true;
                repoInfo.gitHubUrl = repoInfo.remoteUrl
                    .replace('git@github.com:', 'https://github.com/')
                    .replace('.git', '');
            }
        } catch (error) {
            console.log('Could not get remote URL:', error.message);
        }
        
        try {
            // Get repository status
            const statusResult = execSync('git status --porcelain', { 
                cwd: projectPath, 
                encoding: 'utf8',
                timeout: 10000
            });
            
            const statusLines = statusResult.trim().split('\n').filter(line => line.length > 0);
            repoInfo.isClean = statusLines.length === 0;
            repoInfo.uncommittedChanges = statusLines.filter(line => 
                line.startsWith(' M') || line.startsWith('M ') || 
                line.startsWith(' A') || line.startsWith('A ') ||
                line.startsWith(' D') || line.startsWith('D ')
            ).length;
            repoInfo.untrackedFiles = statusLines.filter(line => line.startsWith('??')).length;
        } catch (error) {
            console.log('Could not get repository status:', error.message);
        }
        
        try {
            // Get branch count
            const branchResult = execSync('git branch -a | wc -l', { 
                cwd: projectPath, 
                encoding: 'utf8',
                timeout: 10000
            });
            repoInfo.totalBranches = parseInt(branchResult.trim()) || 0;
        } catch (error) {
            console.log('Could not get branch count:', error.message);
        }
        
        try {
            // Get ahead/behind information
            if (repoInfo.currentBranch && repoInfo.currentBranch !== 'HEAD') {
                const aheadBehindResult = execSync(`git rev-list --count --left-right origin/${repoInfo.currentBranch}...HEAD 2>/dev/null || echo "0	0"`, { 
                    cwd: projectPath, 
                    encoding: 'utf8',
                    timeout: 10000
                });
                
                const [behind, ahead] = aheadBehindResult.trim().split('\t').map(n => parseInt(n) || 0);
                repoInfo.ahead = ahead;
                repoInfo.behind = behind;
            }
        } catch (error) {
            console.log('Could not get ahead/behind info:', error.message);
        }
        
        return repoInfo;
    } catch (error) {
        console.error(`Error analyzing git repository at ${projectPath}:`, error);
        return null;
    }
}