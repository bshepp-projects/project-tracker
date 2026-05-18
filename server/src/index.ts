import fs from 'fs/promises';
import path from 'path';

import { CacheManager } from './services/cache-manager';
import { UserData } from './services/user-data';
import { GitAnalyzer } from './services/git-analyzer';
import { ClaudeAnalyzer } from './services/claude-analyzer';
import { ProjectAnalyzer } from './services/project-analyzer';
import { ProjectDiscovery } from './services/project-discovery';
import { isLoopbackAddress } from './utils';
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
let scanExclude: string[] = []; // extra directory basenames to skip
let scanMaxDepth = 3;

const projectDiscovery = new ProjectDiscovery();

function getScanDirectories(): string[] {
  return scanDirectories;
}

function setScanDirectories(dirs: string[]): void {
  scanDirectories = dirs;
}

function getProjectRoots(): string[] {
  return scanRoots;
}

function resolveProjects() {
  return projectDiscovery.discover({
    roots: scanRoots,
    pins: scanDirectories,
    exclude: scanExclude,
    maxDepth: scanMaxDepth,
  });
}

async function loadDirectoriesFromFile(): Promise<void> {
  try {
    const data = await fs.readFile(DIRECTORIES_CONFIG_FILE, 'utf8');
    const config: DirectoriesConfig = JSON.parse(data);
    scanDirectories = Array.isArray(config.directories) ? config.directories : [];
    scanRoots = Array.isArray(config.roots) ? config.roots : [];
    scanExclude = Array.isArray(config.exclude) ? config.exclude : [];
    scanMaxDepth = typeof config.maxDepth === 'number' ? config.maxDepth : 3;
    console.log(
      `📂 Config loaded: ${scanRoots.length} roots, ${scanDirectories.length} pins, depth ${scanMaxDepth}`
    );
  } catch {
    console.log('📂 Using default directories (config file not found or invalid)');
  }
}

async function saveDirectoriesToFile(): Promise<void> {
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
    getProjectRoots,
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
