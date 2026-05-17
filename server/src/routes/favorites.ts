import { Router } from 'express';
import type { UserData } from '../services/user-data';
import { isPathWithinScanDirs } from '../utils';

export function createFavoritesRouter(
  userData: UserData,
  getScanDirectories: () => string[]
): Router {
  const router = Router();

  router.get('/favorites', (_req, res) => {
    res.json({ success: true, favorites: userData.favorites });
  });

  router.post('/favorites', async (req, res) => {
    try {
      const { projectPath } = req.body;

      if (!projectPath || typeof projectPath !== 'string') {
        res.status(400).json({ success: false, error: 'Project path is required' });
        return;
      }

      if (!isPathWithinScanDirs(projectPath, getScanDirectories())) {
        res.status(403).json({ success: false, error: 'Path is outside the configured scan directories' });
        return;
      }

      if (userData.addFavorite(projectPath)) {
        await userData.save();
        console.log(`⭐ Added favorite: ${projectPath}`);
      }

      res.json({ success: true, message: 'Favorite added', favorites: userData.favorites });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error adding favorite:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  router.delete('/favorites', async (req, res) => {
    try {
      const { projectPath } = req.body;

      if (!projectPath || typeof projectPath !== 'string') {
        res.status(400).json({ success: false, error: 'Project path is required' });
        return;
      }

      if (userData.removeFavorite(projectPath)) {
        await userData.save();
        console.log(`⭐ Removed favorite: ${projectPath}`);
      }

      res.json({ success: true, message: 'Favorite removed', favorites: userData.favorites });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error removing favorite:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });

  return router;
}
