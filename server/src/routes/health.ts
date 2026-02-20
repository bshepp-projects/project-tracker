import { Router } from 'express';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'OK',
      service: 'Project Tracker Backend',
      version: '1.7.0',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
