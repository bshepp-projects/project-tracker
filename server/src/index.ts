import fs from 'fs/promises';
import path from 'path';

import { CacheManager } from './services/cache-manager';
import { UserData } from './services/user-data';
import { GitAnalyzer } from './services/git-analyzer';
import { ClaudeAnalyzer } from './services/claude-analyzer';
import { ProjectAnalyzer } from './services/project-analyzer';
import { ProjectDiscovery } from './services/project-discovery';
import { isLoopbackAddress, parseDirectoriesConfig } from './utils';
import { createApp } from './app';

import type { DirectoriesConfig, TagRulesConfig } from './types';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || 'localhost';

function parseBool(v: string | undefined): boolean {
  return !!v && !['0', 'false', 'no', ''].includes(v.toLowerCase());
}

// The local action bridge is off unless explicitly enabled AND the server
// is bound to loopback (so it stays inert on a 0.0.0.0 box like Magus).
const LOCAL_ACTIONS = {
  enabled: parseBool(process.env.ENABLE_LOCAL_ACTIONS),
  hostIsLoopback: HOST === 'localhost' || isLoopbackAddress(HOST),
};

const DATA_DIR = path.resolve(__dirname, '..');
const DIRECTORIES_CONFIG_FILE = path.join(DATA_DIR, 'directories.json');
const USER_DATA_FILE = path.join(DATA_DIR, 'user-data.json');
const PROJECTS_CACHE_FILE = path.join(DATA_DIR, 'projects-cache.json');
const TAG_RULES_FILE = path.join(DATA_DIR, 'src', 'config', 'tag-rules.json');

let scanDirectories: string[] = []; // explicit project pins (legacy `directories`)
let scanRoots: string[] = []; // parent folders auto-scanned for projects
let scanExclude: string[] = []; // skip entries: basenames (name-based) or absolute paths (path-based hide)
let scanMaxDepth = 3;
// Set when directories.json exists but cannot be parsed; surfaced through
// discovery.skipped so a corrupt config shows up in the UI banner instead of
// silently emptying the tracker.
let configLoadError: string | null = null;

const projectDiscovery = new ProjectDiscovery();

function getScanDirectories(): string[] {
  return scanDirectories;
}

function setScanDirectories(dirs: string[]): void {
  scanDirectories = dirs;
}

function getScanExclude(): string[] {
  return scanExclude;
}

function setScanExclude(e: string[]): void {
  scanExclude = e;
}

function getProjectRoots(): string[] {
  return scanRoots;
}

async function resolveProjects() {
  const result = await projectDiscovery.discover({
    roots: scanRoots,
    pins: scanDirectories,
    exclude: scanExclude,
    maxDepth: scanMaxDepth,
  });
  if (configLoadError) {
    result.skipped.unshift({
      path: DIRECTORIES_CONFIG_FILE,
      reason: `invalid config, running without it: ${configLoadError}`,
    });
  }
  return result;
}

async function loadDirectoriesFromFile(): Promise<void> {
  let data: string;
  try {
    data = await fs.readFile(DIRECTORIES_CONFIG_FILE, 'utf8');
  } catch {
    console.log('📂 Using default directories (config file not found)');
    return;
  }
  try {
    const config: DirectoriesConfig = parseDirectoriesConfig(data);
    scanDirectories = Array.isArray(config.directories) ? config.directories : [];
    scanRoots = Array.isArray(config.roots) ? config.roots : [];
    scanExclude = Array.isArray(config.exclude) ? config.exclude : [];
    scanMaxDepth = typeof config.maxDepth === 'number' ? config.maxDepth : 3;
    configLoadError = null;
    console.log(
      `📂 Config loaded: ${scanRoots.length} roots, ${scanDirectories.length} pins, depth ${scanMaxDepth}`
    );
  } catch (error) {
    configLoadError = error instanceof Error ? error.message : String(error);
    console.error(`⚠️ Invalid directories config (${DIRECTORIES_CONFIG_FILE}): ${configLoadError}`);
  }
}

async function saveDirectoriesToFile(): Promise<void> {
  if (configLoadError) {
    // The on-disk file failed to parse; writing the (empty) in-memory state
    // would destroy whatever the user had. Leave the file for manual repair.
    console.error('⚠️ Not saving directories config: the existing file is invalid and would be overwritten');
    return;
  }
  try {
    // Preserve discovery config (roots/exclude/maxDepth) — the directories
    // route only mutates pins, but a naive write would otherwise drop these.
    const config: DirectoriesConfig = {
      roots: scanRoots,
      exclude: scanExclude,
      maxDepth: scanMaxDepth,
      directories: scanDirectories,
      lastUpdated: new Date().toISOString(),
    };
    await fs.writeFile(DIRECTORIES_CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`💾 Saved directories configuration`);
  } catch (error) {
    console.error('Error saving directories config:', error);
  }
}

async function loadTagRules(): Promise<TagRulesConfig> {
  try {
    const data = await fs.readFile(TAG_RULES_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    console.log('📏 No tag rules file found, using empty rules');
    return { rules: [] };
  }
}

async function startServer(): Promise<void> {
  // Instantiate services
  const cacheManager = new CacheManager(PROJECTS_CACHE_FILE);
  const userData = new UserData(USER_DATA_FILE);
  const gitAnalyzer = new GitAnalyzer();
  const claudeAnalyzer = new ClaudeAnalyzer();
  const projectAnalyzer = new ProjectAnalyzer(gitAnalyzer, userData);

  // Load configuration
  await loadDirectoriesFromFile();
  await userData.load();
  await cacheManager.loadCache();

  const tagRules = await loadTagRules();
  projectAnalyzer.loadTagRules(tagRules.rules);

  const app = createApp({
    cacheManager,
    userData,
    projectAnalyzer,
    claudeAnalyzer,
    gitAnalyzer,
    getScanDirectories,
    setScanDirectories,
    saveDirectories: saveDirectoriesToFile,
    getScanExclude,
    setScanExclude,
    getProjectRoots,
    getScanMaxDepth: () => scanMaxDepth,
    resolveProjects,
    localActions: LOCAL_ACTIONS,
  });

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Project Tracker Backend running on http://${HOST}:${PORT}`);
    console.log(`📂 Scanning directories: ${scanDirectories.length} configured`);
    console.log(`📦 Cache: ${cacheManager.cache.projects.length} projects loaded`);
    console.log(
      `👤 User data: ${Object.keys(userData.tags).length} projects with tags, ${userData.favorites.length} favorites`
    );
  });
}

startServer().catch(console.error);
