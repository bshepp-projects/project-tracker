import request from 'supertest';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
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

  it('GET /projects marks hidden projects and reports hiddenCount', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'pt-proj-'));
    await fsp.writeFile(path.join(tmp, 'package.json'), '{}');
    const app = createTestApp({
      scanDirectories: [tmp],
      scanExclude: [path.resolve(tmp)],
    });

    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    expect(res.body.discovery.hiddenCount).toBe(1);
    expect(res.body.projects.length).toBe(1);
    expect(res.body.projects[0].hidden).toBe(true);

    await fsp.rm(tmp, { recursive: true, force: true });
  });
});
