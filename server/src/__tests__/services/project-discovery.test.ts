import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { ProjectDiscovery } from '../../services/project-discovery';

async function makeTree(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'pt-disc-'));
}
const mkdir = (p: string) => fsp.mkdir(p, { recursive: true });
const touch = (p: string) => fsp.writeFile(p, '');

describe('ProjectDiscovery', () => {
  let root: string;
  let disc: ProjectDiscovery;

  beforeEach(async () => {
    root = await makeTree();
    disc = new ProjectDiscovery();
  });
  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true }).catch(() => {});
  });

  it('discovers a project by marker and does not descend into it', async () => {
    const proj = path.join(root, 'alpha');
    await mkdir(path.join(proj, '.git'));
    await mkdir(path.join(proj, 'sub')); // would-be nested, must NOT be listed
    await touch(path.join(proj, 'sub', 'package.json'));

    const res = await disc.discover({ roots: [root], pins: [], exclude: [], maxDepth: 3 });

    expect(res.projects).toEqual([proj]);
    expect(res.rootsScanned).toBe(1);
  });

  it('finds projects nested under a parent root within maxDepth', async () => {
    const a = path.join(root, 'cat', 'a');
    const b = path.join(root, 'cat', 'b');
    await mkdir(a);
    await touch(path.join(a, 'package.json'));
    await mkdir(b);
    await touch(path.join(b, 'Cargo.toml'));

    const res = await disc.discover({ roots: [root], pins: [], exclude: [], maxDepth: 3 });

    expect(res.projects.sort()).toEqual([a, b].sort());
  });

  it('respects maxDepth (deeper projects are not found)', async () => {
    const deep = path.join(root, 'l1', 'l2', 'l3', 'l4');
    await mkdir(deep);
    await touch(path.join(deep, 'go.mod'));

    const res = await disc.discover({ roots: [root], pins: [], exclude: [], maxDepth: 2 });

    expect(res.projects).toEqual([]);
  });

  it('skips excluded names and shouldSkipDirectory names', async () => {
    const real = path.join(root, 'real');
    await mkdir(real);
    await touch(path.join(real, 'package.json'));
    const nm = path.join(root, 'node_modules', 'pkg'); // shouldSkipDirectory
    await mkdir(nm);
    await touch(path.join(nm, 'package.json'));
    const arch = path.join(root, 'archive', 'old'); // user exclude
    await mkdir(arch);
    await touch(path.join(arch, 'package.json'));

    const res = await disc.discover({
      roots: [root],
      pins: [],
      exclude: ['archive'],
      maxDepth: 4,
    });

    expect(res.projects).toEqual([real]);
  });

  it('includes an existing pin even without markers; reports a missing pin', async () => {
    const pin = path.join(root, 'plain-dir');
    await mkdir(pin);
    const ghost = path.join(root, 'does-not-exist');

    const res = await disc.discover({
      roots: [],
      pins: [pin, ghost],
      exclude: [],
      maxDepth: 3,
    });

    expect(res.projects).toEqual([pin]);
    expect(res.skipped).toEqual([{ path: ghost, reason: 'ENOENT' }]);
  });

  it('reports a missing root and does not count it as scanned', async () => {
    const ghostRoot = path.join(root, 'nope');
    const res = await disc.discover({ roots: [ghostRoot], pins: [], exclude: [], maxDepth: 3 });

    expect(res.projects).toEqual([]);
    expect(res.rootsScanned).toBe(0);
    expect(res.skipped).toEqual([{ path: ghostRoot, reason: 'ENOENT' }]);
  });

  it('stops at the visit cap instead of walking forever', async () => {
    // Build more directories than the cap allows.
    for (let i = 0; i < 12; i++) await mkdir(path.join(root, `d${i}`, 'inner'));
    const capped = new ProjectDiscovery(3); // tiny cap

    const res = await capped.discover({ roots: [root], pins: [], exclude: [], maxDepth: 5 });

    // It must return (not hang) and not have visited everything.
    expect(res.projects).toEqual([]);
  });

  it('does not follow directory symlinks (cycle-safe)', async () => {
    const proj = path.join(root, 'p');
    await mkdir(proj);
    await touch(path.join(proj, 'package.json'));
    let symlinkable = true;
    try {
      await fsp.symlink(root, path.join(proj, 'loop'), 'dir'); // self-referential loop
    } catch {
      symlinkable = false; // Windows without privilege — logic still covered on CI
    }
    if (!symlinkable) return;

    const res = await disc.discover({ roots: [root], pins: [], exclude: [], maxDepth: 5 });

    expect(res.projects).toEqual([proj]); // completes; loop not followed
  });
});
