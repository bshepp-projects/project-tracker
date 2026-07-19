import { Router } from 'express';
import fs from 'fs/promises';
import type { CacheManager } from '../services/cache-manager';
import { isPathWithinScanDirs, normalizeInputPath } from '../utils';

export function createDirectoriesRouter(
  getScanDirectories: () => string[],
  setScanDirectories: (dirs: string[]) => void,
  saveDirectories: () => Promise<void>,
  cacheManager: CacheManager,
  getExclude: () => string[],
  setExclude: (e: string[]) => void,
  validationPaths: () => string[],
  getRoots: () => string[] = () => [],
  getMaxDepth: () => number = () => 3
): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({
      scanDirectories: getScanDirectories(),
      roots: getRoots(),
      exclude: getExclude(),
      maxDepth: getMaxDepth(),
      defaultDirectories: [],
      port: process.env.PORT || 3001,
    });
  });

  router.post('/directories', async (req, res) => {
    try {
      let { directory } = req.body;

      if (!directory || typeof directory !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Directory path is required and must be a string',
        });
        return;
      }

      directory = normalizeInputPath(directory);

      const scanDirs = getScanDirectories();
      if (scanDirs.includes(directory)) {
        res.status(400).json({ success: false, error: 'Directory is already being scanned' });
        return;
      }

      try {
        await fs.access(directory);
        const stats = await fs.stat(directory);
        if (!stats.isDirectory()) {
          res.status(400).json({ success: false, error: 'Path exists but is not a directory' });
          return;
        }
      } catch {
        res.status(400).json({
          success: false,
          error: 'Directory does not exist or is not accessible',
        });
        return;
      }

      scanDirs.push(directory);
      setScanDirectories(scanDirs);
      await saveDirectories();
      await cacheManager.invalidateCache();

      console.log(`✅ Added directory: ${directory}`);
      res.json({ success: true, message: 'Directory added successfully', scanDirectories: scanDirs });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error adding directory:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  router.delete('/directories', async (req, res) => {
    try {
      const { directory } = req.body;

      if (!directory || typeof directory !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Directory path is required and must be a string',
        });
        return;
      }

      const target = normalizeInputPath(directory);

      if (!isPathWithinScanDirs(target, validationPaths())) {
        res.status(400).json({
          success: false,
          error: 'Path is outside the configured scan directories',
        });
        return;
      }

      const exclude = getExclude();
      if (!exclude.includes(target)) {
        exclude.push(target);
        setExclude(exclude);
        await saveDirectories();
        await cacheManager.invalidateCache();
      }

      console.log(`🙈 Hidden project: ${target}`);
      res.json({ success: true, message: 'Project hidden', excluded: target });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error hiding project:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  router.post('/directories/restore', async (req, res) => {
    try {
      const { directory } = req.body;

      if (!directory || typeof directory !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Directory path is required and must be a string',
        });
        return;
      }

      const target = normalizeInputPath(directory);

      if (!isPathWithinScanDirs(target, validationPaths())) {
        res.status(400).json({
          success: false,
          error: 'Path is outside the configured scan directories',
        });
        return;
      }

      const exclude = getExclude();
      const idx = exclude.indexOf(target);
      if (idx !== -1) {
        exclude.splice(idx, 1);
        setExclude(exclude);
        await saveDirectories();
        await cacheManager.invalidateCache();
      }

      console.log(`↩️ Restored project: ${target}`);
      res.json({ success: true, message: 'Project restored', restored: target });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error restoring project:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  router.put('/directories', async (req, res) => {
    try {
      const { directories } = req.body;

      if (!Array.isArray(directories)) {
        res.status(400).json({ success: false, error: 'Directories must be an array' });
        return;
      }

      const validationResults = await Promise.all(
        directories.map(async (dir: string) => {
          try {
            await fs.access(dir);
            const stats = await fs.stat(dir);
            return { dir, valid: stats.isDirectory(), error: null };
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { dir, valid: false, error: msg };
          }
        })
      );

      const invalidDirs = validationResults.filter((r) => !r.valid);
      if (invalidDirs.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Some directories are invalid',
          invalidDirectories: invalidDirs,
        });
        return;
      }

      setScanDirectories([...directories]);
      await saveDirectories();
      await cacheManager.invalidateCache();

      console.log(`🔄 Updated directories: ${directories.length} total`);
      res.json({
        success: true,
        message: 'Directories updated successfully',
        scanDirectories: directories,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error updating directories:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
