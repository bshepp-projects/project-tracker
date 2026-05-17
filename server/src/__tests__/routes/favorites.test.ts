import request from 'supertest';
import { createTestApp, createTestUserData } from '../test-helpers';

describe('Favorites API', () => {
  it('GET /api/favorites returns empty list initially', async () => {
    const app = createTestApp();
    const res = await request(app).get('/api/favorites');
    expect(res.status).toBe(200);
    expect(res.body.favorites).toEqual([]);
  });

  it('POST /api/favorites adds a favorite', async () => {
    const userData = createTestUserData();
    const app = createTestApp({ userData, scanDirectories: ['/scan/root'] });

    const res = await request(app)
      .post('/api/favorites')
      .send({ projectPath: '/scan/root' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.favorites).toContain('/scan/root');
  });

  it('POST /api/favorites rejects missing path', async () => {
    const app = createTestApp();
    const res = await request(app)
      .post('/api/favorites')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/favorites removes a favorite', async () => {
    const userData = createTestUserData();
    userData.addFavorite('/path/to/project');
    const app = createTestApp({ userData });

    const res = await request(app)
      .delete('/api/favorites')
      .send({ projectPath: '/path/to/project' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.favorites).not.toContain('/path/to/project');
  });
});
