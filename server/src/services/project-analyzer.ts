import fs from 'fs/promises';
import path from 'path';
import type { Project, TagRule } from '../types';
import { fileExists } from '../utils';
import type { GitAnalyzer } from './git-analyzer';
import type { UserData } from './user-data';

export class ProjectAnalyzer {
  private tagRules: TagRule[] = [];

  constructor(
    private gitAnalyzer: GitAnalyzer,
    private userData: UserData
  ) {}

  loadTagRules(rules: TagRule[]): void {
    this.tagRules = rules;
  }

  async analyzeProject(projectPath: string, projectName: string): Promise<Project | null> {
    try {
      const files = await this.getFilesRecursively(projectPath);
      const fileNames = files.map((f) => path.basename(f).toLowerCase());
      const extensions = files
        .map((f) => path.extname(f).toLowerCase().slice(1))
        .filter((ext) => ext);

      const hasReadme = fileNames.some((name) => name.startsWith('readme'));
      const hasClaude = fileNames.includes('claude.md');
      const hasVenv = await this.detectVirtualEnv(projectPath, files);

      const technologies = this.detectTechnologies(extensions, fileNames);
      const category = this.detectCategory(extensions, fileNames, projectName);
      const status = this.detectStatus(fileNames);

      const stats = await fs.stat(projectPath);
      const lastModified = stats.mtime.getFullYear().toString();

      const gitPath = path.join(projectPath, '.git');
      let gitHubUrl: string | null = null;
      let isGitHub = false;
      let lastCommitDate: string | null = null;
      let githubActions = null;
      let localVsRemote = null;

      try {
        if (await fileExists(gitPath)) {
          const remoteUrl = await this.gitAnalyzer.getRemoteUrl(projectPath);
          if (this.gitAnalyzer.isGitHubRepo(remoteUrl)) {
            isGitHub = true;
            gitHubUrl = remoteUrl!
              .replace('git@github.com:', 'https://github.com/')
              .replace('.git', '');
            githubActions = await this.gitAnalyzer.getGitHubActions(projectPath);
          }
          const lastCommit = await this.gitAnalyzer.getLastCommit(projectPath);
          if (lastCommit?.date) {
            lastCommitDate = lastCommit.date;
          }

          const workingTreeStatus = await this.gitAnalyzer.getWorkingTreeStatus(projectPath);
          const branchStatus = await this.gitAnalyzer.getBranchStatus(projectPath);

          localVsRemote = {
            isSynced: workingTreeStatus.isClean === true && branchStatus.isSynced,
            hasUncommittedChanges: !workingTreeStatus.isClean,
            aheadCount: branchStatus.aheadCount || 0,
            behindCount: branchStatus.behindCount || 0,
            description: branchStatus.description || 'Unknown status',
          };
        }
      } catch {
        // Ignore git errors
      }

      const autoTags = this.generateTags(status, technologies, category, projectName, projectPath);
      const userTags = this.userData.getTagsForProject(projectPath);
      const mergedTags = [...new Set([...autoTags, ...userTags])];

      return {
        name: projectName,
        path: projectPath,
        description: projectName,
        status,
        technologies,
        category,
        tags: mergedTags,
        userTags,
        hasReadme,
        hasClaude,
        hasVenv,
        isGitHub,
        gitHubUrl,
        lastCommitDate,
        githubActions,
        localVsRemote,
        lastUpdated: lastModified,
        isFavorite: this.userData.isFavorite(projectPath),
        isScanned: true,
        dateScanned: new Date().toISOString(),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`Error analyzing project ${projectName}:`, msg);
      return null;
    }
  }

  private async getFilesRecursively(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.name.startsWith('.') && !entry.name.startsWith('.env')) continue;
        if (entry.name === 'node_modules') continue;
        if (entry.name === '__pycache__') continue;
        if (entry.name === '.git') continue;

        if (entry.isDirectory()) {
          if (files.length < 1000) {
            await this.getFilesRecursively(fullPath, files);
          }
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return files;
  }

  private async detectVirtualEnv(projectPath: string, files: string[]): Promise<boolean> {
    try {
      const entries = await fs.readdir(projectPath);
      const hasVenvDir = entries.some(
        (entry) => entry === 'venv' || entry === '.venv' || entry === 'env'
      );
      const hasRequirements = files.some(
        (f) => path.basename(f).toLowerCase() === 'requirements.txt'
      );
      return hasVenvDir || hasRequirements;
    } catch {
      return false;
    }
  }

  detectTechnologies(extensions: string[], fileNames: string[]): string {
    const techMap: Record<string, string> = {
      py: 'Python',
      js: 'JavaScript',
      ts: 'TypeScript',
      html: 'HTML',
      css: 'CSS',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      rs: 'Rust',
      go: 'Go',
      php: 'PHP',
      rb: 'Ruby',
      swift: 'Swift',
      kt: 'Kotlin',
      vue: 'Vue.js',
      jsx: 'React',
      tsx: 'React',
    };

    const detected = new Set<string>();

    for (const ext of extensions) {
      if (techMap[ext]) {
        detected.add(techMap[ext]);
      }
    }

    if (fileNames.includes('package.json')) detected.add('Node.js');
    if (fileNames.includes('cargo.toml')) detected.add('Rust');
    if (fileNames.includes('requirements.txt') || fileNames.includes('setup.py'))
      detected.add('Python');
    if (fileNames.includes('dockerfile')) detected.add('Docker');
    if (fileNames.includes('docker-compose.yml')) detected.add('Docker');
    if (fileNames.includes('pom.xml')) detected.add('Maven');
    if (fileNames.includes('build.gradle')) detected.add('Gradle');

    return Array.from(detected).join(', ') || 'Mixed';
  }

  detectCategory(extensions: string[], fileNames: string[], projectName: string): string {
    const name = projectName.toLowerCase();

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

  detectStatus(fileNames: string[]): string {
    if (
      fileNames.includes('dockerfile') ||
      fileNames.includes('docker-compose.yml') ||
      fileNames.some((name) => name.includes('prod'))
    ) {
      return 'Production';
    }
    return 'Development';
  }

  generateTags(
    status: string,
    technologies: string,
    category: string,
    projectName: string = '',
    projectPath: string = ''
  ): string[] {
    const tags = new Set<string>();

    // Status-based tags
    if (status.toLowerCase() === 'production') tags.add('production');
    if (status.toLowerCase() === 'development') tags.add('development');

    // Technology-based tags (generic, stays in code)
    if (technologies.includes('JavaScript') || technologies.includes('HTML')) tags.add('web');
    if (technologies.includes('React')) tags.add('frontend');
    if (technologies.includes('Node.js')) tags.add('backend');
    if (technologies.includes('Python') && (category.includes('AI') || category.includes('ML')))
      tags.add('ai');
    if (technologies.includes('Python') && !tags.has('ai')) tags.add('backend');
    if (category.includes('Web')) tags.add('web');
    if (technologies.includes('Docker')) tags.add('production');

    // Data-driven tag rules from config
    const nameLower = projectName.toLowerCase();
    const pathLower = projectPath.toLowerCase();

    for (const rule of this.tagRules) {
      const nameMatch = rule.namePatterns.some((p) => nameLower.includes(p));
      const pathMatch = rule.pathPatterns.some((p) => pathLower.includes(p));
      if (nameMatch || pathMatch) {
        tags.add(rule.tag);
      }
    }

    // Category-based AI tag
    if (category.includes('AI') || category.includes('ML')) {
      tags.add('ai');
    }

    return Array.from(tags);
  }
}
