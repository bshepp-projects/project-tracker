import { Router } from 'express';
import fs from 'fs/promises';
import type { UserData } from '../services/user-data';
import type { CacheManager } from '../services/cache-manager';
import type { ProjectAnalyzer } from '../services/project-analyzer';
import type { DiscoveryResult } from '../services/project-discovery';
import { isPathWithinScanDirs } from '../utils';

export function createTagsRouter(
  userData: UserData,
  cacheManager: CacheManager,
  projectAnalyzer: ProjectAnalyzer,
  resolveProjects: () => Promise<DiscoveryResult>,
  validationPaths: () => string[]
): Router {
  const router = Router();

  router.get('/tags', (_req, res) => {
    try {
      // Tags are already aggregated into the cache by the projects scan.
      // Re-deriving them here meant re-analyzing every project on each
      // request, which timed out once discovery found many projects.
      const tags = Array.from(cacheManager.cache.tags).sort();
      res.json({ success: true, tags, scanTime: new Date().toISOString() });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error getting tags:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  router.get('/projects/:projectPath/tags', (req, res) => {
    try {
      const decodedPath = decodeURIComponent(req.params.projectPath);

      if (!isPathWithinScanDirs(decodedPath, validationPaths())) {
        res.status(403).json({ success: false, error: 'Path is outside the configured scan directories' });
        return;
      }

      const tags = userData.getTagsForProject(decodedPath);
      res.json({ success: true, projectPath: decodedPath, tags });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error getting project tags:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  router.post('/projects/:projectPath/tags', async (req, res) => {
    try {
      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        res.status(400).json({ success: false, error: 'Tags must be an array' });
        return;
      }

      const decodedPath = decodeURIComponent(req.params.projectPath);

      if (!isPathWithinScanDirs(decodedPath, validationPaths())) {
        res.status(403).json({ success: false, error: 'Path is outside the configured scan directories' });
        return;
      }

      try {
        await fs.access(decodedPath);
      } catch {
        res.status(404).json({ success: false, error: 'Project directory not found' });
        return;
      }

      userData.setTagsForProject(decodedPath, tags);
      await userData.save();

      console.log(`🏷️ Saved tags for ${decodedPath}: ${tags.join(', ')}`);
      res.json({ success: true, message: 'Tags saved successfully', projectPath: decodedPath, tags });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error updating project tags:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  router.delete('/tags/:tagName', async (req, res) => {
    try {
      const { tagName } = req.params;
      console.log(`🗑️ Removing tag: ${tagName}`);

      const removedFromCount = userData.removeTagFromAll(tagName);
      await userData.save();

      cacheManager.removeTag(tagName);
      await cacheManager.saveCache();

      res.json({
        success: true,
        message: `Tag "${tagName}" removed from ${removedFromCount} project(s)`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error removing tag:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
