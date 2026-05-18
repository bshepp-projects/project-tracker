import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createTestApp } from '../test-helpers';

describe('Local actions bridge', () => {
  let scanDir: string;

  beforeEach(async () => {
    scanDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pt-act-'));
  });
  afterEach(async () => {
    await fsp.rm(scanDir, { recursive: true, force: true }).catch(() => {});
  });

  it('403s (actionsDisabled) when the feature flag is off', async () => {
    const spawnAction = jest.fn();
    const app = createTestApp({
      scanDirectories: [scanDir],
      localActions: { enabled: false, hostIsLoopback: true },
      spawnAction,
    });

    const res = await request(app).post('/api/actions/open-folder').send({ projectPath: scanDir });

    expect(res.status).toBe(403);
    expect(res.body.actionsDisabled).toBe(true);
    expect(spawnAction).not.toHaveBeenCalled();
  });

  it('403s when the server is not bound to loopback (Magus-like 0.0.0.0) even if flag is on', async () => {
    const spawnAction = jest.fn();
    const app = createTestApp({
      scanDirectories: [scanDir],
      localActions: { enabled: true, hostIsLoopback: false },
      spawnAction,
    });

    const res = await request(app).post('/api/actions/open-folder').send({ projectPath: scanDir });

    expect(res.status).toBe(403);
    expect(res.body.actionsDisabled).toBe(true);
    expect(spawnAction).not.toHaveBeenCalled();
  });

  it('400s on an unknown action', async () => {
    const app = createTestApp({
      scanDirectories: [scanDir],
      localActions: { enabled: true, hostIsLoopback: true },
    });
    const res = await request(app).post('/api/actions/rm-rf').send({ projectPath: scanDir });
    expect(res.status).toBe(400);
  });

  it('403s when projectPath is outside the scan directories', async () => {
    const spawnAction = jest.fn();
    const app = createTestApp({
      scanDirectories: [scanDir],
      localActions: { enabled: true, hostIsLoopback: true },
      spawnAction,
    });

    const res = await request(app)
      .post('/api/actions/open-folder')
      .send({ projectPath: '/etc' });

    expect(res.status).toBe(403);
    expect(spawnAction).not.toHaveBeenCalled();
  });

  it('spawns the built command for a valid enabled loopback request', async () => {
    const spawnAction = jest.fn();
    const app = createTestApp({
      scanDirectories: [scanDir],
      localActions: { enabled: true, hostIsLoopback: true },
      spawnAction,
      platform: 'win32',
    });

    const res = await request(app)
      .post('/api/actions/open-folder')
      .send({ projectPath: scanDir });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('launched');
    expect(spawnAction).toHaveBeenCalledWith('explorer.exe', [scanDir]);
  });

  it('returns mode=copy for activate-venv and does not spawn', async () => {
    const spawnAction = jest.fn();
    const app = createTestApp({
      scanDirectories: [scanDir],
      localActions: { enabled: true, hostIsLoopback: true },
      spawnAction,
      platform: 'linux',
    });

    const res = await request(app)
      .post('/api/actions/activate-venv')
      .send({ projectPath: scanDir });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('copy');
    expect(res.body.text).toBe(`source "${scanDir}/venv/bin/activate"`);
    expect(spawnAction).not.toHaveBeenCalled();
  });

  it('GET /api/actions/status reflects whether the bridge is usable', async () => {
    const on = createTestApp({ localActions: { enabled: true, hostIsLoopback: true } });
    const off = createTestApp({ localActions: { enabled: false, hostIsLoopback: true } });

    const a = await request(on).get('/api/actions/status');
    const b = await request(off).get('/api/actions/status');

    expect(a.body.enabled).toBe(true);
    expect(b.body.enabled).toBe(false);
  });
});
