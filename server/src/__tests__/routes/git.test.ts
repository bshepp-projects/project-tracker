import request from 'supertest';
import { createTestApp } from '../test-helpers';

describe('Git repos API', () => {
  it('responds immediately with a scanning flag on a cold cache (never blocks on a full scan)', async () => {
    const app = createTestApp(); // resolveProjects -> [] in tests

    const res = await request(app).get('/api/git/repos');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.repositories)).toBe(true);
    expect(res.body.scanning).toBe(true);
  });
});
