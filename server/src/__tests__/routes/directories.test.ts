import request from 'supertest';
import path from 'path';
import { createTestApp } from '../test-helpers';

describe('Directories API', () => {
  describe('GET /api/config', () => {
    it('returns current scan directories', async () => {
      const dirs = ['/path/a', '/path/b'];
      const app = createTestApp({ scanDirectories: dirs });

      const res = await request(app).get('/api/config');

      expect(res.status).toBe(200);
      expect(res.body.scanDirectories).toEqual(dirs);
    });
  });

  describe('POST /api/directories', () => {
    it('rejects missing directory', async () => {
      const app = createTestApp();
      const res = await request(app)
        .post('/api/directories')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects duplicate directory', async () => {
      const existingDir = process.cwd();
      const app = createTestApp({ scanDirectories: [existingDir] });
      const res = await request(app)
        .post('/api/directories')
        .send({ directory: existingDir });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already being scanned');
    });
  });

  describe('DELETE /api/directories (hide)', () => {
    it('rejects a path outside the configured scan dirs', async () => {
      const app = createTestApp({ scanDirectories: [] });
      const res = await request(app)
        .delete('/api/directories')
        .send({ directory: '/nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('outside');
    });

    it('rejects a missing/empty directory', async () => {
      const app = createTestApp({ scanDirectories: [process.cwd()] });
      const res = await request(app).delete('/api/directories').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('hides a project by adding its resolved path to exclude', async () => {
      const dir = process.cwd();
      const exclude: string[] = [];
      const app = createTestApp({ scanDirectories: [dir], scanExclude: exclude });

      const res = await request(app).delete('/api/directories').send({ directory: dir });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(exclude).toContain(path.resolve(dir));
    });

    it('is idempotent (no duplicate exclude entry on repeat)', async () => {
      const dir = process.cwd();
      const exclude: string[] = [];
      const app = createTestApp({ scanDirectories: [dir], scanExclude: exclude });

      await request(app).delete('/api/directories').send({ directory: dir });
      const res = await request(app).delete('/api/directories').send({ directory: dir });

      expect(res.status).toBe(200);
      expect(exclude.filter((e) => e === path.resolve(dir)).length).toBe(1);
    });
  });

  describe('PUT /api/directories', () => {
    it('rejects non-array body', async () => {
      const app = createTestApp();
      const res = await request(app)
        .put('/api/directories')
        .send({ directories: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/directories/restore (unhide)', () => {
    it('removes the resolved path from exclude', async () => {
      const dir = process.cwd();
      const exclude: string[] = [path.resolve(dir)];
      const app = createTestApp({ scanDirectories: [dir], scanExclude: exclude });

      const res = await request(app)
        .post('/api/directories/restore')
        .send({ directory: dir });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(exclude).not.toContain(path.resolve(dir));
    });

    it('is idempotent when the path is not excluded', async () => {
      const exclude: string[] = [];
      const app = createTestApp({ scanDirectories: [process.cwd()], scanExclude: exclude });
      const res = await request(app)
        .post('/api/directories/restore')
        .send({ directory: process.cwd() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(exclude.length).toBe(0);
    });

    it('rejects a path outside the configured scan dirs', async () => {
      const app = createTestApp({ scanDirectories: [] });
      const res = await request(app)
        .post('/api/directories/restore')
        .send({ directory: '/nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('outside');
    });
  });
});
