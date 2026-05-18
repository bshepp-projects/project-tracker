import { Router } from 'express';
import path from 'path';
import type { GitAnalyzer } from '../services/git-analyzer';
import type { DiscoveryResult } from '../services/project-discovery';

export function createGitRouter(
  gitAnalyzer: GitAnalyzer,
  resolveProjects: () => Promise<DiscoveryResult>
): Router {
  const router = Router();

  router.get('/git/repos', async (_req, res) => {
    try {
      console.log('🔀 Scanning for git repositories...');
      const allGitRepos = [];
      const discovered = await resolveProjects();

      for (const projectPath of discovered.projects) {
        try {
          const gitRepo = await gitAnalyzer.analyzeGitRepo(projectPath, path.basename(projectPath));
          if (gitRepo) allGitRepos.push(gitRepo);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`Could not scan ${projectPath} for git repos:`, msg);
        }
      }

      console.log(`🔀 Found ${allGitRepos.length} git repositories`);
      res.json({
        success: true,
        repositories: allGitRepos,
        scanTime: new Date().toISOString(),
        discovery: {
          rootsScanned: discovered.rootsScanned,
          projectsFound: discovered.projects.length,
          skipped: discovered.skipped,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error scanning git repositories:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
