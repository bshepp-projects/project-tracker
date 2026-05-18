import request from 'supertest';
import { createTestApp, createTestCacheManager } from '../test-helpers';

describe('Projects API', () => {
  it('GET /projects/cached returns instantly and kicks a background refresh when the cache is out of sync with discovery', async () => {
    const cacheManager = createTestCacheManager(); // empty cache (0 projects)
    const app = createTestApp({
      cacheManager,
      scanDirectories: ['/nonexistent-x'], // discovery -> 1 "project"
    });

    const res = await request(app).get('/api/projects/cached');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.projects)).toBe(true);
    // discovery sees 1, cache has 0 -> stale -> a background scan is kicked
    expect(res.body.discovery.projectsFound).toBe(1);
    expect(res.body.scanning).toBe(true);
  });
});
