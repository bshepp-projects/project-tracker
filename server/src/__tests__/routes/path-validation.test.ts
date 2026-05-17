import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createTestApp, createTestUserData } from '../test-helpers';

describe('Path containment validation', () => {
  let scanDir: string;

  beforeEach(async () => {
    scanDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pt-scan-'));
  });

  afterEach(async () => {
    await fsp.rm(scanDir, { recursive: true, force: true }).catch(() => {});
  });

  it('GET tags rejects a path outside the configured scan directories', async () => {
    const app = createTestApp({ scanDirectories: [scanDir] });
    const res = await request(app).get(
      `/api/projects/${encodeURIComponent('/etc/passwd')}/tags`
    );
    expect(res.status).toBe(403);
  });

  it('POST tags rejects (and does not persist) a path outside scan directories', async () => {
    const userData = createTestUserData();
    const app = createTestApp({ userData, scanDirectories: [scanDir] });

    const res = await request(app)
      .post(`/api/projects/${encodeURIComponent('/etc/cron.d/evil')}/tags`)
      .send({ tags: ['pwned'] });

    expect(res.status).toBe(403);
    expect(userData.getTagsForProject('/etc/cron.d/evil')).toEqual([]);
  });

  it('POST tags accepts a path inside a configured scan directory', async () => {
    const userData = createTestUserData();
    const app = createTestApp({ userData, scanDirectories: [scanDir] });

    const res = await request(app)
      .post(`/api/projects/${encodeURIComponent(scanDir)}/tags`)
      .send({ tags: ['web'] });

    expect(res.status).toBe(200);
    expect(userData.getTagsForProject(scanDir)).toEqual(['web']);
  });

  it('POST favorites rejects a path outside scan directories', async () => {
    const userData = createTestUserData();
    const app = createTestApp({ userData, scanDirectories: [scanDir] });

    const res = await request(app)
      .post('/api/favorites')
      .send({ projectPath: '/etc/secrets' });

    expect(res.status).toBe(403);
    expect(userData.favorites).not.toContain('/etc/secrets');
  });

  it('POST favorites accepts a path inside a configured scan directory', async () => {
    const userData = createTestUserData();
    const app = createTestApp({ userData, scanDirectories: [scanDir] });

    const res = await request(app)
      .post('/api/favorites')
      .send({ projectPath: scanDir });

    expect(res.status).toBe(200);
    expect(userData.favorites).toContain(scanDir);
  });
});
