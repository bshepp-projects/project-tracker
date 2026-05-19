import fs from 'fs/promises';
import path from 'path';
import { shouldSkipDirectory } from '../utils';

/** Files/dirs whose presence marks a directory as a project root. */
const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'CLAUDE.md',
];

/** Never descend into these — they are never project containers. */
const INTRINSIC_SKIP = new Set([
  'node_modules',
  '__pycache__',
  'venv',
  '.venv',
  'dist',
  'build',
]);

export interface DiscoveryConfig {
  /** Parent folders to auto-scan for project roots. */
  roots: string[];
  /** Explicit project directories (legacy `directories.json` entries). */
  pins: string[];
  /** Additional directory basenames to skip. */
  exclude: string[];
  /** How deep to walk under each root (root itself is depth 0). */
  maxDepth: number;
}

export interface DiscoverySkip {
  path: string;
  reason: string;
}

export interface DiscoveryResult {
  projects: string[];
  hidden: string[];
  skipped: DiscoverySkip[];
  rootsScanned: number;
}

export class ProjectDiscovery {
  constructor(private maxVisits = 5000) {}

  async discover(config: DiscoveryConfig): Promise<DiscoveryResult> {
    const projects = new Set<string>();
    const skipped: DiscoverySkip[] = [];
    const visitedInodes = new Set<string>();
    const excludeNames = new Set<string>();
    const excludePaths = new Set<string>();
    for (const e of config.exclude) {
      if (path.isAbsolute(e)) excludePaths.add(path.resolve(e));
      else excludeNames.add(e);
    }
    const hidden = new Set<string>();
    let rootsScanned = 0;
    let visits = 0;

    const errCode = (e: unknown): string =>
      (e as NodeJS.ErrnoException)?.code || 'ENOENT';

    // Explicit pins are projects regardless of markers.
    for (const raw of config.pins) {
      const pin = path.resolve(raw);
      try {
        const st = await fs.stat(pin);
        if (st.isDirectory()) {
          if (excludePaths.has(pin)) hidden.add(pin);
          else projects.add(pin);
        } else skipped.push({ path: pin, reason: 'ENOTDIR' });
      } catch (e) {
        skipped.push({ path: pin, reason: errCode(e) });
      }
    }

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (visits >= this.maxVisits) return;
      visits++;

      const rp = path.resolve(dir);
      if (excludePaths.has(rp)) {
        hidden.add(rp);
        return;
      }

      let lst;
      try {
        lst = await fs.lstat(dir);
      } catch {
        return;
      }
      if (lst.isSymbolicLink()) return; // never follow symlinks
      const inode = `${lst.dev}:${lst.ino}`;
      if (visitedInodes.has(inode)) return; // cycle guard
      visitedInodes.add(inode);

      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      if (entries.some((e) => PROJECT_MARKERS.includes(e.name))) {
        projects.add(dir);
        return; // a project — do not descend into it
      }

      if (depth >= config.maxDepth) return;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue; // also excludes symlinked dirs
        const name = entry.name;
        if (INTRINSIC_SKIP.has(name) || excludeNames.has(name) || shouldSkipDirectory(name)) {
          continue;
        }
        await walk(path.join(dir, name), depth + 1);
      }
    };

    for (const raw of config.roots) {
      const rootDir = path.resolve(raw);
      try {
        const st = await fs.stat(rootDir);
        if (!st.isDirectory()) {
          skipped.push({ path: rootDir, reason: 'ENOTDIR' });
          continue;
        }
      } catch (e) {
        skipped.push({ path: rootDir, reason: errCode(e) });
        continue;
      }
      rootsScanned++;
      await walk(rootDir, 0);
    }

    return {
      projects: [...projects].sort(),
      hidden: [...hidden].sort(),
      skipped,
      rootsScanned,
    };
  }
}
