import fs from 'fs/promises';
import path from 'path';

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
