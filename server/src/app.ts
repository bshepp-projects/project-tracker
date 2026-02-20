import express from 'express';
import cors from 'cors';

import type { CacheManager } from './services/cache-manager';
import type { UserData } from './services/user-data';
import type { ProjectAnalyzer } from './services/project-analyzer';
import type { ClaudeAnalyzer } from './services/claude-analyzer';
import type { GitAnalyzer } from './services/git-analyzer';

import { createHealthRouter } from './routes/health';
import { createProjectsRouter } from './routes/projects';
import { createDirectoriesRouter } from './routes/directories';
import { createTagsRouter } from './routes/tags';
import { createFavoritesRouter } from './routes/favorites';
import { createClaudeRouter } from './routes/claude';
import { createGitRouter } from './routes/git';

export interface AppDependencies {
  cacheManager: CacheManager;
  userData: UserData;
  projectAnalyzer: ProjectAnalyzer;
  claudeAnalyzer: ClaudeAnalyzer;
  gitAnalyzer: GitAnalyzer;
  getScanDirectories: () => string[];
  setScanDirectories: (dirs: string[]) => void;
  saveDirectories: () => Promise<void>;
}

export function createApp(deps: AppDependencies): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api', createHealthRouter());
  app.use('/api', createProjectsRouter(deps.projectAnalyzer, deps.cacheManager, deps.getScanDirectories));
  app.use(
    '/api',
    createDirectoriesRouter(deps.getScanDirectories, deps.setScanDirectories, deps.saveDirectories, deps.cacheManager)
  );
  app.use('/api', createTagsRouter(deps.userData, deps.cacheManager, deps.projectAnalyzer, deps.getScanDirectories));
  app.use('/api', createFavoritesRouter(deps.userData));
  app.use('/api', createClaudeRouter(deps.claudeAnalyzer, deps.getScanDirectories));
  app.use('/api', createGitRouter(deps.gitAnalyzer, deps.getScanDirectories));

  return app;
}
