import { exec } from 'child_process';
import path from 'path';
import type { GitRepo, CommitInfo, BranchStatus, WorkingTreeStatus, GitHubActionsInfo } from '../types';
import { fileExists } from '../utils';

interface GitCommandResult {
  stdout: string;
  stderr: string;
  error: Error | null;
}

export class GitAnalyzer {
  async analyzeGitRepo(projectPath: string, projectName: string): Promise<GitRepo | null> {
    try {
      const gitPath = path.join(projectPath, '.git');
      if (!(await fileExists(gitPath))) {
        return null;
      }

      const currentBranch = await this.getCurrentBranch(projectPath);
      const remoteUrl = await this.getRemoteUrl(projectPath);
      const isGitHub = this.isGitHubRepo(remoteUrl);
      const lastCommit = await this.getLastCommit(projectPath);
      const branchStatus = await this.getBranchStatus(projectPath);
      const workingTreeStatus = await this.getWorkingTreeStatus(projectPath);
      const hasGitignore = await fileExists(path.join(projectPath, '.gitignore'));
      const totalBranches = await this.getBranchCount(projectPath);
      const lastActivity = await this.getLastActivity(projectPath);

      let githubActions: GitHubActionsInfo | null = null;
      if (isGitHub) {
        githubActions = await this.getGitHubActions(projectPath);
      }

      return {
        name: projectName,
        path: projectPath,
        isGitRepo: true,
        currentBranch,
        remoteUrl,
        isGitHub,
        hasGitignore,
        lastCommit,
        branchStatus: branchStatus.description,
        aheadCount: branchStatus.ahead,
        behindCount: branchStatus.behind,
        workingTreeClean: workingTreeStatus.isClean,
        uncommittedChanges: workingTreeStatus.modified,
        untrackedFiles: workingTreeStatus.untracked,
        totalBranches,
        lastActivity,
        githubActions,
        dateScanned: new Date().toISOString(),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`Error analyzing git repo ${projectName}:`, msg);
      return null;
    }
  }

  private executeGitCommand(projectPath: string, command: string): Promise<GitCommandResult> {
    return new Promise((resolve) => {
      const fullCommand = `cd "${projectPath}" && git ${command}`;
      exec(fullCommand, { timeout: 10000 }, (error, stdout, stderr) => {
        resolve({
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim(),
          error: error,
        });
      });
    });
  }

  async getCurrentBranch(projectPath: string): Promise<string | null> {
    try {
      const result = await this.executeGitCommand(projectPath, 'branch --show-current');
      return result.stdout || 'detached HEAD';
    } catch {
      return null;
    }
  }

  async getRemoteUrl(projectPath: string): Promise<string | null> {
    try {
      const result = await this.executeGitCommand(projectPath, 'remote get-url origin');
      return result.stdout || null;
    } catch {
      return null;
    }
  }

  isGitHubRepo(remoteUrl: string | null): boolean {
    if (!remoteUrl) return false;
    return remoteUrl.includes('github.com');
  }

  async getLastCommit(projectPath: string): Promise<CommitInfo | null> {
    try {
      const result = await this.executeGitCommand(
        projectPath,
        'log -1 --pretty=format:"%H|%s|%an|%ar"'
      );
      if (!result.stdout) return null;

      const [hash, message, author, date] = result.stdout.replace(/"/g, '').split('|');
      return {
        hash: hash ? hash.substring(0, 8) : 'unknown',
        message: message || 'No commit message',
        author: author || 'Unknown',
        date: date || 'Unknown',
      };
    } catch {
      return null;
    }
  }

  async getBranchStatus(projectPath: string): Promise<BranchStatus> {
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

      const isSynced = ahead === 0 && behind === 0;

      return { ahead, behind, aheadCount: ahead, behindCount: behind, isSynced, description };
    } catch {
      return {
        ahead: 0,
        behind: 0,
        aheadCount: 0,
        behindCount: 0,
        isSynced: false,
        description: 'Git command failed',
      };
    }
  }

  async getWorkingTreeStatus(projectPath: string): Promise<WorkingTreeStatus> {
    try {
      const result = await this.executeGitCommand(projectPath, 'status --porcelain');
      const lines = result.stdout.split('\n').filter((line) => line.trim());

      let modified = 0;
      let untracked = 0;

      for (const line of lines) {
        if (line.startsWith('??')) {
          untracked++;
        } else {
          modified++;
        }
      }

      return { isClean: lines.length === 0, modified, untracked };
    } catch {
      return { isClean: null, modified: 0, untracked: 0 };
    }
  }

  async getBranchCount(projectPath: string): Promise<number> {
    try {
      const result = await this.executeGitCommand(projectPath, 'branch -a');
      return result.stdout.split('\n').filter((line) => line.trim()).length;
    } catch {
      return 0;
    }
  }

  async getLastActivity(projectPath: string): Promise<string> {
    try {
      const result = await this.executeGitCommand(projectPath, 'log -1 --pretty=format:"%cr"');
      return result.stdout.replace(/"/g, '') || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  async getGitHubActions(projectPath: string): Promise<GitHubActionsInfo | null> {
    try {
      return new Promise((resolve) => {
        const command = `cd "${projectPath}" && gh run list --limit 1 --json status,workflowName,createdAt 2>/dev/null`;
        exec(command, { timeout: 5000 }, (error, stdout) => {
          if (error || !stdout?.trim()) {
            resolve(null);
            return;
          }
          try {
            const runs = JSON.parse(stdout);
            if (runs && runs.length > 0) {
              const lastRun = runs[0];
              resolve({
                status: lastRun.status === 'completed' ? 'success' : lastRun.status,
                workflowName: lastRun.workflowName,
                lastRun: this.formatDate(lastRun.createdAt),
              });
              return;
            }
          } catch {
            // Invalid JSON
          }
          resolve(null);
        });
      });
    } catch {
      return null;
    }
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
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
