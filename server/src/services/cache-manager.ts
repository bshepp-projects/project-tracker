import fs from 'fs/promises';
import type { CacheData, Project, ClaudeProject, GitRepo } from '../types';

const CACHE_VERSION = '1.0.0';
const CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour

export class CacheManager {
  cache: CacheData = {
    version: CACHE_VERSION,
    timestamp: null,
    projects: [],
    claudeProjects: [],
    gitRepos: [],
    tags: new Set(),
  };

  isScanning = false;

  constructor(private cacheFilePath: string) {}

  async loadCache(): Promise<boolean> {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf8');
      const loaded = JSON.parse(data);

      if (loaded.version === CACHE_VERSION) {
        this.cache = {
          ...loaded,
          tags: new Set(loaded.tags || []),
        };
        console.log(
          `📦 Loaded cache with ${this.cache.projects.length} projects (age: ${this.getCacheAge()}ms)`
        );
        return true;
      }
    } catch {
      console.log('📦 No valid cache found, will scan on first request');
    }
    return false;
  }

  async saveCache(): Promise<void> {
    try {
      const toSave = {
        ...this.cache,
        tags: Array.from(this.cache.tags),
        timestamp: Date.now(),
      };
      await fs.writeFile(this.cacheFilePath, JSON.stringify(toSave, null, 2));
      console.log(`💾 Saved cache with ${this.cache.projects.length} projects`);
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  getCacheAge(): number {
    if (!this.cache.timestamp) return Infinity;
    return Date.now() - this.cache.timestamp;
  }

  isCacheValid(maxAge: number = CACHE_MAX_AGE): boolean {
    return this.cache.projects.length > 0 && this.getCacheAge() < maxAge;
  }

  async updateProjectsCache(projects: Project[]): Promise<void> {
    this.cache.projects = projects;
    this.cache.timestamp = Date.now();

    this.cache.tags = new Set<string>();
    for (const project of projects) {
      if (project.tags && Array.isArray(project.tags)) {
        for (const tag of project.tags) {
          this.cache.tags.add(tag);
        }
      }
    }

    await this.saveCache();
  }

  async updateClaudeCache(claudeProjects: ClaudeProject[]): Promise<void> {
    this.cache.claudeProjects = claudeProjects;
    await this.saveCache();
  }

  async updateGitCache(gitRepos: GitRepo[]): Promise<void> {
    this.cache.gitRepos = gitRepos;
    await this.saveCache();
  }

  async invalidateCache(): Promise<void> {
    this.cache = {
      version: CACHE_VERSION,
      timestamp: null,
      projects: [],
      claudeProjects: [],
      gitRepos: [],
      tags: new Set(),
    };
    try {
      await fs.unlink(this.cacheFilePath);
      console.log('🗑️ Cache invalidated');
    } catch {
      // File might not exist
    }
  }

  removeTag(tagName: string): void {
    this.cache.tags.delete(tagName);
    for (const project of this.cache.projects) {
      if (project.tags) {
        const idx = project.tags.indexOf(tagName);
        if (idx !== -1) {
          project.tags.splice(idx, 1);
        }
      }
    }
  }
}
