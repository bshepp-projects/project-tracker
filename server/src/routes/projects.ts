import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { ProjectAnalyzer } from '../services/project-analyzer';
import type { CacheManager } from '../services/cache-manager';
import type { Project } from '../types';
import { shouldSkipDirectory } from '../utils';

export function createProjectsRouter(
  projectAnalyzer: ProjectAnalyzer,
  cacheManager: CacheManager,
  getScanDirectories: () => string[]
): Router {
  const router = Router();

  async function scanAllProjects(): Promise<Project[]> {
    const allProjects: Project[] = [];
    const scanDirectories = getScanDirectories();

    for (const scanDir of scanDirectories) {
      try {
        const stats = await fs.stat(scanDir);
        if (stats.isDirectory()) {
          const dirName = path.basename(scanDir);
          if (shouldSkipDirectory(dirName)) continue;

          const project = await projectAnalyzer.analyzeProject(scanDir, dirName);
          if (project) {
            allProjects.push(project);
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Could not scan directory ${scanDir}:`, msg);
      }
    }

    return allProjects;
  }

  router.get('/projects/cached', async (_req, res) => {
    try {
      const forceRefresh = _req.query.refresh === 'true';
      const scanDirectories = getScanDirectories();

      if (!forceRefresh && cacheManager.isCacheValid()) {
        console.log('📦 Returning cached projects');
        res.json({
          success: true,
          projects: cacheManager.cache.projects,
          fromCache: true,
          cacheAge: cacheManager.getCacheAge(),
          scanTime: new Date(cacheManager.cache.timestamp!).toISOString(),
          scannedDirectories: scanDirectories,
        });
        return;
      }

      if (!cacheManager.isScanning) {
        cacheManager.isScanning = true;
        console.log('🔄 Starting background scan...');

        scanAllProjects()
          .then(async (projects) => {
            await cacheManager.updateProjectsCache(projects);
            cacheManager.isScanning = false;
            console.log(`✅ Background scan complete: ${projects.length} projects cached`);
          })
          .catch((error) => {
            console.error('Background scan error:', error);
            cacheManager.isScanning = false;
          });
      }

      res.json({
        success: true,
        projects: cacheManager.cache.projects || [],
        fromCache: true,
        scanning: true,
        cacheAge: cacheManager.getCacheAge(),
        scanTime: cacheManager.cache.timestamp
          ? new Date(cacheManager.cache.timestamp).toISOString()
          : null,
        scannedDirectories: scanDirectories,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error with cached projects:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  router.get('/projects', async (_req, res) => {
    try {
      console.log('🔍 Scanning for projects...');
      const allProjects = await scanAllProjects();

      console.log(`✅ Found ${allProjects.length} projects`);
      await cacheManager.updateProjectsCache(allProjects);

      res.json({
        success: true,
        projects: allProjects,
        scanTime: new Date().toISOString(),
        scannedDirectories: getScanDirectories(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error scanning projects:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
