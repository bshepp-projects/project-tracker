import express from 'express';
import path from 'path';
import os from 'os';
import { createApp, type AppDependencies } from '../app';
import { CacheManager } from '../services/cache-manager';
import { UserData } from '../services/user-data';
import { GitAnalyzer } from '../services/git-analyzer';
import { ClaudeAnalyzer } from '../services/claude-analyzer';
import { ProjectAnalyzer } from '../services/project-analyzer';

export function createTestUserData(): UserData {
  const tmpPath = path.join(os.tmpdir(), `test-userdata-${Date.now()}.json`);
  return new UserData(tmpPath);
}

export function createTestCacheManager(): CacheManager {
  const tmpPath = path.join(os.tmpdir(), `test-cache-${Date.now()}.json`);
  return new CacheManager(tmpPath);
}

interface TestAppOptions {
  userData?: UserData;
  cacheManager?: CacheManager;
  scanDirectories?: string[];
  localActions?: { enabled: boolean; hostIsLoopback: boolean };
  spawnAction?: (file: string, args: string[]) => void;
  platform?: NodeJS.Platform;
}

export function createTestApp(options: TestAppOptions = {}): express.Express {
  const userData = options.userData ?? createTestUserData();
  const cacheManager = options.cacheManager ?? createTestCacheManager();
  const gitAnalyzer = new GitAnalyzer();
  const claudeAnalyzer = new ClaudeAnalyzer();
  const projectAnalyzer = new ProjectAnalyzer(gitAnalyzer, userData);

  let scanDirs = options.scanDirectories ?? [];

  const deps: AppDependencies = {
    cacheManager,
    userData,
    projectAnalyzer,
    claudeAnalyzer,
    gitAnalyzer,
    getScanDirectories: () => scanDirs,
    setScanDirectories: (dirs: string[]) => { scanDirs = dirs; },
    saveDirectories: async () => {},
    getProjectRoots: () => [],
    // In tests, the configured scanDirectories ARE the resolved projects
    // (no real discovery walk) — preserves prior route-test semantics.
    resolveProjects: async () => ({
      projects: scanDirs,
      hidden: [],
      skipped: [],
      rootsScanned: 0,
    }),
    // Bridge disabled by default so existing suites are unaffected.
    localActions: options.localActions ?? { enabled: false, hostIsLoopback: true },
    spawnAction: options.spawnAction,
    actionPlatform: options.platform,
  };

  return createApp(deps);
}
