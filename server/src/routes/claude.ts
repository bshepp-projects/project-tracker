import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { ClaudeAnalyzer } from '../services/claude-analyzer';

function shouldSkipDirectory(dirName: string): boolean {
  return (
    dirName.startsWith('$Temp') ||
    dirName.endsWith('.tmp') ||
    dirName === '$RECYCLE.BIN' ||
    dirName === 'System Volume Information' ||
    (dirName.startsWith('.') && dirName !== '.claude')
  );
}

export function createClaudeRouter(
  claudeAnalyzer: ClaudeAnalyzer,
  getScanDirectories: () => string[]
): Router {
  const router = Router();

  router.get('/claude/projects', async (_req, res) => {
    try {
      console.log('🤖 Scanning for Claude projects...');
      const allClaudeProjects = [];
      const scanDirectories = getScanDirectories();

      for (const scanDir of scanDirectories) {
        try {
          const stats = await fs.stat(scanDir);
          if (stats.isDirectory()) {
            const dirName = path.basename(scanDir);
            if (shouldSkipDirectory(dirName)) continue;

            const claudeProject = await claudeAnalyzer.analyzeClaudeProject(scanDir, dirName);
            if (claudeProject) {
              allClaudeProjects.push(claudeProject);
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`Could not scan directory ${scanDir} for Claude projects:`, msg);
        }
      }

      console.log(`🤖 Found ${allClaudeProjects.length} Claude projects`);
      res.json({
        success: true,
        projects: allClaudeProjects,
        scanTime: new Date().toISOString(),
        scannedDirectories: scanDirectories,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error scanning Claude projects:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
