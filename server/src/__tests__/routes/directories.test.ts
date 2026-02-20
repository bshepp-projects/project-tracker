import request from 'supertest';
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

  describe('DELETE /api/directories', () => {
    it('rejects directory not in list', async () => {
      const app = createTestApp({ scanDirectories: [] });
      const res = await request(app)
        .delete('/api/directories')
        .send({ directory: '/nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not in the scan list');
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
});
