import express from 'express';
import cors from 'cors';

import { isAllowedOrigin } from './utils';

import type { DiscoveryResult } from './services/project-discovery';
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
import { createActionsRouter } from './routes/actions';

export interface AppDependencies {
  cacheManager: CacheManager;
  userData: UserData;
  projectAnalyzer: ProjectAnalyzer;
  claudeAnalyzer: ClaudeAnalyzer;
  gitAnalyzer: GitAnalyzer;
  getScanDirectories: () => string[];
  setScanDirectories: (dirs: string[]) => void;
  saveDirectories: () => Promise<void>;
  /** Configured parent roots (for path-containment validation). */
  getProjectRoots: () => string[];
  /** Run discovery: expand roots + pins into the effective project set. */
  resolveProjects: () => Promise<DiscoveryResult>;
  /** Local action bridge gating (off by default; inert unless loopback). */
  localActions: { enabled: boolean; hostIsLoopback: boolean };
  /** Test seam: override the spawn runner. */
  spawnAction?: (file: string, args: string[]) => void;
  /** Test seam: override the platform used to build commands. */
  actionPlatform?: NodeJS.Platform;
}

export function createApp(deps: AppDependencies): express.Express {
  const app = express();
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin ?? undefined)),
    })
  );
  app.use(express.json());

  const validationPaths = () => [...deps.getScanDirectories(), ...deps.getProjectRoots()];

  app.use('/api', createHealthRouter());
  app.use('/api', createProjectsRouter(deps.projectAnalyzer, deps.cacheManager, deps.resolveProjects));
  app.use(
    '/api',
    createDirectoriesRouter(deps.getScanDirectories, deps.setScanDirectories, deps.saveDirectories, deps.cacheManager)
  );
  app.use(
    '/api',
    createTagsRouter(deps.userData, deps.cacheManager, deps.projectAnalyzer, deps.resolveProjects, validationPaths)
  );
  app.use('/api', createFavoritesRouter(deps.userData, validationPaths));
  app.use('/api', createClaudeRouter(deps.claudeAnalyzer, deps.resolveProjects));
  app.use('/api', createGitRouter(deps.gitAnalyzer, deps.resolveProjects));
  app.use(
    '/api',
    createActionsRouter({
      enabled: deps.localActions.enabled,
      hostIsLoopback: deps.localActions.hostIsLoopback,
      validationPaths,
      spawnAction: deps.spawnAction,
      platform: deps.actionPlatform,
    })
  );

  return app;
}
