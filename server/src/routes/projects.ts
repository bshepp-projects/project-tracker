import { Router } from 'express';
import path from 'path';
import type { ProjectAnalyzer } from '../services/project-analyzer';
import type { CacheManager } from '../services/cache-manager';
import type { DiscoveryResult } from '../services/project-discovery';
import type { Project } from '../types';

interface DiscoverySummary {
  rootsScanned: number;
  projectsFound: number;
  skipped: DiscoveryResult['skipped'];
}

export function createProjectsRouter(
  projectAnalyzer: ProjectAnalyzer,
  cacheManager: CacheManager,
  resolveProjects: () => Promise<DiscoveryResult>
): Router {
  const router = Router();

  async function scanAllProjects(): Promise<{ projects: Project[]; discovery: DiscoverySummary }> {
    const discovered = await resolveProjects();
    const allProjects: Project[] = [];

    for (const projectPath of discovered.projects) {
      try {
        const project = await projectAnalyzer.analyzeProject(projectPath, path.basename(projectPath));
        if (project) allProjects.push(project);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Could not analyze ${projectPath}:`, msg);
      }
    }

    return {
      projects: allProjects,
      discovery: {
        rootsScanned: discovered.rootsScanned,
        projectsFound: allProjects.length,
        skipped: discovered.skipped,
      },
    };
  }

  router.get('/projects/cached', async (_req, res) => {
    try {
      const forceRefresh = _req.query.refresh === 'true';
      // Discovery is a cheap stat/readdir walk (no git) — run it for the
      // up-to-date "found vs skipped" summary even on the cached path.
      const discovered = await resolveProjects();
      const discovery: DiscoverySummary = {
        rootsScanned: discovered.rootsScanned,
        projectsFound: discovered.projects.length,
        skipped: discovered.skipped,
      };

      if (!forceRefresh && cacheManager.isCacheValid()) {
        console.log('📦 Returning cached projects');
        res.json({
          success: true,
          projects: cacheManager.cache.projects,
          fromCache: true,
          cacheAge: cacheManager.getCacheAge(),
          scanTime: new Date(cacheManager.cache.timestamp!).toISOString(),
          discovery,
        });
        return;
      }

      if (!cacheManager.isScanning) {
        cacheManager.isScanning = true;
        console.log('🔄 Starting background scan...');

        scanAllProjects()
          .then(async ({ projects }) => {
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
        discovery,
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
      const { projects, discovery } = await scanAllProjects();

      console.log(
        `✅ Found ${projects.length} projects (${discovery.rootsScanned} roots, ${discovery.skipped.length} skipped)`
      );
      await cacheManager.updateProjectsCache(projects);

      res.json({
        success: true,
        projects,
        scanTime: new Date().toISOString(),
        discovery,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error scanning projects:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
