import { Router } from 'express';
import path from 'path';
import type { ClaudeAnalyzer } from '../services/claude-analyzer';
import type { DiscoveryResult } from '../services/project-discovery';

export function createClaudeRouter(
  claudeAnalyzer: ClaudeAnalyzer,
  resolveProjects: () => Promise<DiscoveryResult>
): Router {
  const router = Router();

  router.get('/claude/projects', async (_req, res) => {
    try {
      console.log('🤖 Scanning for Claude projects...');
      const allClaudeProjects = [];
      const discovered = await resolveProjects();

      for (const projectPath of discovered.projects) {
        try {
          const claudeProject = await claudeAnalyzer.analyzeClaudeProject(
            projectPath,
            path.basename(projectPath)
          );
          if (claudeProject) allClaudeProjects.push(claudeProject);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`Could not scan ${projectPath} for Claude projects:`, msg);
        }
      }

      console.log(`🤖 Found ${allClaudeProjects.length} Claude projects`);
      res.json({
        success: true,
        projects: allClaudeProjects,
        scanTime: new Date().toISOString(),
        discovery: {
          rootsScanned: discovered.rootsScanned,
          projectsFound: discovered.projects.length,
          skipped: discovered.skipped,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error scanning Claude projects:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
