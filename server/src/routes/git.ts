import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { GitAnalyzer } from '../services/git-analyzer';
import { shouldSkipDirectory } from '../utils';

export function createGitRouter(
  gitAnalyzer: GitAnalyzer,
  getScanDirectories: () => string[]
): Router {
  const router = Router();

  router.get('/git/repos', async (_req, res) => {
    try {
      console.log('🔀 Scanning for git repositories...');
      const allGitRepos = [];
      const scanDirectories = getScanDirectories();

      for (const scanDir of scanDirectories) {
        try {
          const stats = await fs.stat(scanDir);
          if (stats.isDirectory()) {
            const dirName = path.basename(scanDir);
            if (shouldSkipDirectory(dirName)) continue;

            const gitRepo = await gitAnalyzer.analyzeGitRepo(scanDir, dirName);
            if (gitRepo) {
              allGitRepos.push(gitRepo);
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`Could not scan directory ${scanDir} for git repos:`, msg);
        }
      }

      console.log(`🔀 Found ${allGitRepos.length} git repositories`);
      res.json({
        success: true,
        repositories: allGitRepos,
        scanTime: new Date().toISOString(),
        scannedDirectories: scanDirectories,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error scanning git repositories:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
