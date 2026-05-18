import { Router } from 'express';
import path from 'path';
import type { GitAnalyzer } from '../services/git-analyzer';
import type { DiscoveryResult } from '../services/project-discovery';
import type { GitRepo } from '../types';

export function createGitRouter(
  gitAnalyzer: GitAnalyzer,
  resolveProjects: () => Promise<DiscoveryResult>
): Router {
  const router = Router();

  // Scanning N repos × several git calls each is slow and unbounded; doing
  // it synchronously per request timed out behind the reverse proxy once
  // discovery found many projects. Same fix as /projects/cached: serve the
  // last result instantly and refresh in the background. In-memory is fine —
  // git status is live data, cheap to recompute after a restart.
  let cache: GitRepo[] = [];
  let cacheTime = 0;
  let discovery: DiscoveryResult | null = null;
  let scanning = false;

  async function scan(): Promise<void> {
    const discovered = await resolveProjects();
    const repos: GitRepo[] = [];
    for (const projectPath of discovered.projects) {
      try {
        const gitRepo = await gitAnalyzer.analyzeGitRepo(projectPath, path.basename(projectPath));
        if (gitRepo) repos.push(gitRepo);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Could not scan ${projectPath} for git repos:`, msg);
      }
    }
    cache = repos;
    cacheTime = Date.now();
    discovery = discovered;
    console.log(`🔀 Git scan complete: ${repos.length} repositories`);
  }

  router.get('/git/repos', (_req, res) => {
    try {
      if (!scanning) {
        scanning = true;
        scan()
          .then(() => {
            scanning = false;
          })
          .catch((error) => {
            console.error('Git scan error:', error);
            scanning = false;
          });
      }

      res.json({
        success: true,
        repositories: cache,
        fromCache: cacheTime > 0,
        scanning: true,
        scanTime: cacheTime > 0 ? new Date(cacheTime).toISOString() : null,
        discovery: discovery
          ? {
              rootsScanned: discovery.rootsScanned,
              projectsFound: discovery.projects.length,
              skipped: discovery.skipped,
            }
          : { rootsScanned: 0, projectsFound: 0, skipped: [] },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error scanning git repositories:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
