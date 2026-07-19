import request from 'supertest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createTestApp } from '../test-helpers';

describe('Claude projects API', () => {
  let root: string;
  let withFile: string;
  let withDir: string;
  let plain: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-route-'));
    withFile = path.join(root, 'with-claude-md');
    withDir = path.join(root, 'with-claude-dir');
    plain = path.join(root, 'plain-project');
    await fs.mkdir(withFile);
    await fs.mkdir(withDir);
    await fs.mkdir(plain);
    await fs.writeFile(
      path.join(withFile, 'CLAUDE.md'),
      '**Name:** Test Project\n**Role:** Web frontend work\n'
    );
    await fs.mkdir(path.join(withDir, '.claude'));
    await fs.writeFile(
      path.join(withDir, '.claude', 'settings.local.json'),
      JSON.stringify({ permissions: { allow: ['Bash(ls:*)', 'Read'] } })
    );
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('returns only projects with a CLAUDE.md file or .claude directory', async () => {
    const app = createTestApp({ scanDirectories: [withFile, withDir, plain] });

    const res = await request(app).get('/api/claude/projects');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const paths = res.body.projects.map((p: { path: string }) => p.path).sort();
    expect(paths).toEqual([withFile, withDir].sort());
  });

  it('extracts CLAUDE.md metadata and .claude permissions', async () => {
    const app = createTestApp({ scanDirectories: [withFile, withDir] });

    const res = await request(app).get('/api/claude/projects');

    const fileProj = res.body.projects.find((p: { path: string }) => p.path === withFile);
    expect(fileProj.name).toBe('Test Project');
    expect(fileProj.claudeRole).toBe('Web frontend work');
    expect(fileProj.hasClaudeFile).toBe(true);

    const dirProj = res.body.projects.find((p: { path: string }) => p.path === withDir);
    expect(dirProj.hasClaudeDir).toBe(true);
    expect(dirProj.permissionCount).toBe(2);
  });

  it('excludes hidden projects and reports discovery', async () => {
    const app = createTestApp({
      scanDirectories: [withFile, withDir],
      scanExclude: [withFile],
    });

    const res = await request(app).get('/api/claude/projects');

    expect(res.body.projects.map((p: { path: string }) => p.path)).toEqual([withDir]);
    expect(res.body.discovery.projectsFound).toBe(1);
    expect(res.body.discovery.skipped).toEqual([]);
  });
});
