import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { CacheManager } from '../services/cache-manager';

export function createDirectoriesRouter(
  getScanDirectories: () => string[],
  setScanDirectories: (dirs: string[]) => void,
  saveDirectories: () => Promise<void>,
  cacheManager: CacheManager
): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({
      scanDirectories: getScanDirectories(),
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

      directory = directory.trim();

      if (process.platform === 'linux') {
        const windowsDriveMatch = directory.match(/^([A-Za-z]):[\\\/]/);
        if (windowsDriveMatch) {
          const driveLetter = windowsDriveMatch[1].toLowerCase();
          const pathWithoutDrive = directory.substring(2).replace(/\\/g, '/');
          directory = `/mnt/${driveLetter}${pathWithoutDrive}`;
        }
      }

      if (directory.startsWith('~/')) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        directory = path.join(homeDir, directory.substring(2));
      }

      directory = path.resolve(directory);

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

      const scanDirs = getScanDirectories();
      const index = scanDirs.indexOf(directory);
      if (index === -1) {
        res.status(400).json({ success: false, error: 'Directory is not in the scan list' });
        return;
      }

      scanDirs.splice(index, 1);
      setScanDirectories(scanDirs);
      await saveDirectories();
      await cacheManager.invalidateCache();

      console.log(`🗑️ Removed directory: ${directory}`);
      res.json({
        success: true,
        message: 'Directory removed successfully',
        scanDirectories: scanDirs,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error removing directory:', error);
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
