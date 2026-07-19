import fs from 'fs/promises';
import path from 'path';

import type { DirectoriesConfig } from './types';

/**
 * Parse directories.json content. Tolerates a leading UTF-8 BOM (what
 * PowerShell writes as "UTF-8") and rejects non-object payloads, so a
 * corrupt file throws a clear error instead of silently emptying the
 * scan config. (0xFEFF spelled numerically to keep this file ASCII.)
 */
export function parseDirectoriesConfig(raw: string): DirectoriesConfig {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const parsed = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('directories config must be a JSON object');
  }
  return parsed as DirectoriesConfig;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Directories that are never treated as scannable projects.
 * Single source of truth — previously copy-pasted across four route files
 * (the git route's copy was missing the dot-directory clause).
 */
export function shouldSkipDirectory(dirName: string): boolean {
  return (
    dirName.startsWith('$Temp') ||
    dirName.endsWith('.tmp') ||
    dirName === '$RECYCLE.BIN' ||
    dirName === 'System Volume Information' ||
    (dirName.startsWith('.') && dirName !== '.claude')
  );
}

/**
 * True only if `targetPath` is one of the configured scan directories or
 * lives inside one. Used to reject client-supplied paths that would let the
 * API read/write user data keyed to arbitrary filesystem locations.
 */
export function isPathWithinScanDirs(targetPath: string, scanDirs: string[]): boolean {
  const resolvedTarget = path.resolve(targetPath);
  return scanDirs.some((dir) => {
    const resolvedDir = path.resolve(dir);
    return (
      resolvedTarget === resolvedDir ||
      resolvedTarget.startsWith(resolvedDir + path.sep)
    );
  });
}

/**
 * CORS origin allowlist for this localhost tool. Permits non-browser /
 * same-origin requests (no Origin), file:// pages (Origin "null" — the
 * documented "double-click the HTML" workflow), and localhost/127.0.0.1
 * on any port. Everything else is denied so a malicious site the user
 * visits cannot read API responses cross-origin.
 *
 * Note: this limits cross-origin *reads*, not state-changing CSRF; the
 * primary control for that remains binding to localhost only.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === 'null') return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * True if `addr` is an IPv4/IPv6 loopback address. Used to gate the local
 * action bridge so it only ever fires for requests from the same machine.
 * Node may report loopback as `::1` or the IPv4-mapped `::ffff:127.0.0.1`.
 */
export function isLoopbackAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  if (addr === '::1' || addr === '::ffff:127.0.0.1') return true;
  const v4 = addr.startsWith('::ffff:') ? addr.slice(7) : addr;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4);
}

/**
 * Normalize a client-supplied path: trim, convert a Windows drive path to a
 * WSL `/mnt/<drive>` path when running on Linux, expand a leading `~/`, then
 * resolve to an absolute path. Shared by the directories route (POST/DELETE/
 * restore) so path matching is consistent. Pure; `platform` is injectable
 * for testing.
 */
export function normalizeInputPath(
  input: string,
  platform: NodeJS.Platform = process.platform
): string {
  let p = input.trim();
  if (platform === 'linux') {
    const m = p.match(/^([A-Za-z]):[\\/]/);
    if (m) {
      const drive = m[1].toLowerCase();
      const rest = p.substring(2).replace(/\\/g, '/');
      p = `/mnt/${drive}${rest}`;
    }
  }
  if (p.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    p = path.join(home, p.substring(2));
  }
  return path.resolve(p);
}
