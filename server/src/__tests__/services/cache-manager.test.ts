import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { CacheManager } from '../../services/cache-manager';
import type { Project } from '../../types';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let cacheFilePath: string;

  beforeEach(async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-test-'));
    cacheFilePath = path.join(tmpDir, 'test-cache.json');
    cacheManager = new CacheManager(cacheFilePath);
  });

  afterEach(async () => {
    try {
      await fs.unlink(cacheFilePath);
      await fs.rmdir(path.dirname(cacheFilePath));
    } catch {
      // Cleanup best-effort
    }
  });

  describe('initialization', () => {
    it('starts with empty cache', () => {
      expect(cacheManager.cache.projects).toEqual([]);
      expect(cacheManager.cache.timestamp).toBeNull();
      expect(cacheManager.cache.tags.size).toBe(0);
    });

    it('reports invalid cache when empty', () => {
      expect(cacheManager.isCacheValid()).toBe(false);
    });

    it('reports infinite cache age when no timestamp', () => {
      expect(cacheManager.getCacheAge()).toBe(Infinity);
    });
  });

  describe('saveCache / loadCache round-trip', () => {
    it('persists and restores projects', async () => {
      const mockProject: Project = {
        name: 'test-project',
        path: '/tmp/test-project',
        description: 'A test project',
        status: 'Development',
        technologies: 'TypeScript',
        category: 'General Project',
        tags: ['web', 'backend'],
        userTags: [],
        hasReadme: true,
        hasClaude: false,
        hasVenv: false,
        isGitHub: false,
        gitHubUrl: null,
        lastCommitDate: null,
        githubActions: null,
        localVsRemote: null,
        lastUpdated: '2024',
        isFavorite: false,
        isScanned: true,
        dateScanned: '2024-01-01T00:00:00.000Z',
      };

      await cacheManager.updateProjectsCache([mockProject]);

      const newManager = new CacheManager(cacheFilePath);
      const loaded = await newManager.loadCache();

      expect(loaded).toBe(true);
      expect(newManager.cache.projects).toHaveLength(1);
      expect(newManager.cache.projects[0].name).toBe('test-project');
      expect(newManager.cache.tags.has('web')).toBe(true);
      expect(newManager.cache.tags.has('backend')).toBe(true);
    });
  });

  describe('isCacheValid', () => {
    it('returns true when cache is fresh', async () => {
      await cacheManager.updateProjectsCache([
        { name: 'p', tags: [] } as unknown as Project,
      ]);
      expect(cacheManager.isCacheValid()).toBe(true);
    });

    it('returns false when cache is expired', async () => {
      await cacheManager.updateProjectsCache([
        { name: 'p', tags: [] } as unknown as Project,
      ]);
      cacheManager.cache.timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      expect(cacheManager.isCacheValid()).toBe(false);
    });
  });

  describe('invalidateCache', () => {
    it('clears all cached data', async () => {
      await cacheManager.updateProjectsCache([
        { name: 'p', tags: ['tag1'] } as unknown as Project,
      ]);
      expect(cacheManager.cache.projects).toHaveLength(1);

      await cacheManager.invalidateCache();

      expect(cacheManager.cache.projects).toHaveLength(0);
      expect(cacheManager.cache.timestamp).toBeNull();
      expect(cacheManager.cache.tags.size).toBe(0);
    });
  });

  describe('removeTag', () => {
    it('removes tag from cache tags set and all projects', async () => {
      await cacheManager.updateProjectsCache([
        { name: 'p1', tags: ['web', 'backend'] } as unknown as Project,
        { name: 'p2', tags: ['web', 'ai'] } as unknown as Project,
      ]);

      cacheManager.removeTag('web');

      expect(cacheManager.cache.tags.has('web')).toBe(false);
      expect(cacheManager.cache.projects[0].tags).toEqual(['backend']);
      expect(cacheManager.cache.projects[1].tags).toEqual(['ai']);
    });
  });

  describe('tag collection', () => {
    it('collects all unique tags from projects', async () => {
      await cacheManager.updateProjectsCache([
        { name: 'p1', tags: ['web', 'backend'] } as unknown as Project,
        { name: 'p2', tags: ['web', 'ai'] } as unknown as Project,
      ]);

      expect(cacheManager.cache.tags.size).toBe(3);
      expect(cacheManager.cache.tags.has('web')).toBe(true);
      expect(cacheManager.cache.tags.has('backend')).toBe(true);
      expect(cacheManager.cache.tags.has('ai')).toBe(true);
    });
  });
});
