import fs from 'fs';
import path from 'path';

import { Router } from 'express';

// package.json sits two levels up from routes/ in both src/ (tests) and dist/ (runtime).
const { version } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')
) as { version: string };

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'OK',
      service: 'Project Tracker Backend',
      version,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
