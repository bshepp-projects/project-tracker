# Fix Remove Button (hide via path-exclude + Show-hidden filter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 🚫 Remove button reversibly hide a single project (any project, discovered or pinned) by adding its resolved full path to `exclude`, and let users reveal/un-hide via a default-off "Show hidden" filter.

**Architecture:** `ProjectDiscovery` splits `exclude` into basename entries (silent skip, unchanged) and absolute-path entries (surfaced in a new `hidden` list). `DELETE /api/directories` adds a normalized path to `exclude`; a new `POST /api/directories/restore` removes it. The projects route analyzes hidden projects too, flags them `hidden:true`, and reports `hiddenCount`. The frontend filters hidden projects out unless a "Show hidden" checkbox is on, where they render dimmed with an Unhide button.

**Tech Stack:** TypeScript, Express, Jest + ts-jest + supertest. Static HTML/JS frontend (no FE test harness — manual verification).

---

## File Structure

**Backend (modify):**
- `server/src/utils.ts` — new pure `normalizeInputPath()` (WSL/`~`/resolve), used by directories route.
- `server/src/services/project-discovery.ts` — split exclude; add `hidden` to `DiscoveryResult`.
- `server/src/routes/directories.ts` — rewrite DELETE (hide), add `POST /directories/restore`, use `normalizeInputPath` in POST.
- `server/src/app.ts` — thread `getScanExclude`/`setScanExclude` + `validationPaths` into the directories router.
- `server/src/index.ts` — add `getScanExclude`/`setScanExclude`.
- `server/src/routes/projects.ts` — analyze hidden, mark `hidden:true`, add `hiddenCount`, fix cached stale/`projectsFound` math.
- `server/src/types.ts` — `Project.hidden?: boolean`.
- `server/src/__tests__/test-helpers.ts` — exclude state; exclude-aware `resolveProjects`; `hidden:[]`.

**Backend (tests):**
- `server/src/__tests__/utils.test.ts` — `normalizeInputPath`.
- `server/src/__tests__/services/project-discovery.test.ts` — path-exclude → hidden; basename still silent; excluded pin → hidden.
- `server/src/__tests__/routes/directories.test.ts` — rewrite the stale DELETE test; add hide/restore/containment/idempotency.
- `server/src/__tests__/routes/projects.test.ts` — hidden marking + `hiddenCount`.

**Frontend (modify):**
- `project-tracker.html` — CSS classes, "Show hidden" checkbox, `filterProjects()`, `renderProjects()` (badge + conditional button), `unhideDirectory()`, `renderDiscoveryInfo()` hidden count, `ignoreDirectory()` tooltip/name fix.

**Docs (modify):**
- `README.md`, `CLAUDE.md` — new endpoint + hide/filter behavior.
- `docs/SESSION_LOG.md` — session entry.

> Note: `git.ts` / `claude.ts` iterate `discovered.projects` only, so hidden projects are naturally excluded from the Git/Claude pages — correct, no change needed.

---

### Task 1: Extract `normalizeInputPath` pure helper

**Files:**
- Modify: `server/src/utils.ts`
- Test: `server/src/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the end of `server/src/__tests__/utils.test.ts` (inside the top-level `describe` file scope — append a new `describe` block). First add `normalizeInputPath` to the existing import from `'../utils'` at the top of the file (it currently imports `isPathWithinScanDirs` etc.):

```ts
describe('normalizeInputPath', () => {
  it('converts a Windows drive path to a /mnt path when platform is linux', () => {
    const out = normalizeInputPath('C:\\Users\\me\\proj', 'linux');
    expect(out).toBe(path.resolve('/mnt/c/Users/me/proj'));
  });

  it('trims and resolves without WSL conversion off-linux', () => {
    const out = normalizeInputPath('  /a/b/../c  ', 'darwin');
    expect(out).toBe(path.resolve('/a/b/../c'));
  });

  it('expands a leading ~/ using HOME/USERPROFILE', () => {
    const prev = process.env.HOME;
    process.env.HOME = path.resolve('/home/tester');
    try {
      expect(normalizeInputPath('~/work', 'darwin')).toBe(path.resolve('/home/tester/work'));
    } finally {
      process.env.HOME = prev;
    }
  });
});
```

(`path` is already imported in `utils.test.ts`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/__tests__/utils.test.ts -t normalizeInputPath`
Expected: FAIL — `normalizeInputPath is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `server/src/utils.ts` (it already imports `fs/promises` and `path`):

```ts
/**
 * Normalize a client-supplied path: trim, convert a Windows drive path to a
 * WSL `/mnt/<drive>` path when running on Linux, expand a leading `~/`, then
 * resolve to an absolute path. Shared by the directories route (POST/DELETE/
 * restore) so path matching is consistent. Pure; `platform` is injectable
 * for testing.
 */
export function normalizeInputPath(
  input: string,
  platform: NodeJS.Platform = process.platform
): string {
  let p = input.trim();
  if (platform === 'linux') {
    const m = p.match(/^([A-Za-z]):[\\/]/);
    if (m) {
      const drive = m[1].toLowerCase();
      const rest = p.substring(2).replace(/\\/g, '/');
      p = `/mnt/${drive}${rest}`;
    }
  }
  if (p.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    p = path.join(home, p.substring(2));
  }
  return path.resolve(p);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/__tests__/utils.test.ts -t normalizeInputPath`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add server/src/utils.ts server/src/__tests__/utils.test.ts
git commit -m "Add normalizeInputPath shared path helper"
```

---

### Task 2: `ProjectDiscovery` — path-aware exclude + `hidden`

**Files:**
- Modify: `server/src/services/project-discovery.ts`
- Modify: `server/src/__tests__/test-helpers.ts` (add `hidden: []` so the build stays green)
- Test: `server/src/__tests__/services/project-discovery.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these three `it` blocks inside the existing `describe('ProjectDiscovery', ...)` in `server/src/__tests__/services/project-discovery.test.ts`:

```ts
  it('path-excludes only the matching project, surfacing it as hidden', async () => {
    const a = path.join(root, 'r1', 'sketch');
    const b = path.join(root, 'r2', 'sketch');
    await mkdir(a);
    await touch(path.join(a, 'package.json'));
    await mkdir(b);
    await touch(path.join(b, 'package.json'));

    const res = await disc.discover({ roots: [root], pins: [], exclude: [a], maxDepth: 3 });

    expect(res.projects).toEqual([b]);
    expect(res.hidden).toEqual([path.resolve(a)]);
  });

  it('basename exclude still silently skips and is NOT surfaced as hidden', async () => {
    const real = path.join(root, 'real');
    await mkdir(real);
    await touch(path.join(real, 'package.json'));
    const arch = path.join(root, 'archive', 'old');
    await mkdir(arch);
    await touch(path.join(arch, 'package.json'));

    const res = await disc.discover({
      roots: [root],
      pins: [],
      exclude: ['archive'],
      maxDepth: 4,
    });

    expect(res.projects).toEqual([real]);
    expect(res.hidden).toEqual([]);
  });

  it('an excluded pin is surfaced as hidden, not as a project', async () => {
    const pin = path.join(root, 'pinned');
    await mkdir(pin);

    const res = await disc.discover({ roots: [], pins: [pin], exclude: [pin], maxDepth: 3 });

    expect(res.projects).toEqual([]);
    expect(res.hidden).toEqual([path.resolve(pin)]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest src/__tests__/services/project-discovery.test.ts`
Expected: FAIL — `res.hidden` is `undefined` (3 new tests fail; existing pass).

- [ ] **Step 3: Implement**

In `server/src/services/project-discovery.ts`:

3a. Add `hidden` to the result interface (replace the `DiscoveryResult` interface):

```ts
export interface DiscoveryResult {
  projects: string[];
  hidden: string[];
  skipped: DiscoverySkip[];
  rootsScanned: number;
}
```

3b. In `discover()`, replace the line `const exclude = new Set(config.exclude);` with:

```ts
    const excludeNames = new Set<string>();
    const excludePaths = new Set<string>();
    for (const e of config.exclude) {
      if (path.isAbsolute(e)) excludePaths.add(path.resolve(e));
      else excludeNames.add(e);
    }
    const hidden = new Set<string>();
```

3c. In the pin loop, replace:

```ts
        if (st.isDirectory()) projects.add(pin);
        else skipped.push({ path: pin, reason: 'ENOTDIR' });
```

with:

```ts
        if (st.isDirectory()) {
          if (excludePaths.has(pin)) hidden.add(pin);
          else projects.add(pin);
        } else skipped.push({ path: pin, reason: 'ENOTDIR' });
```

3d. In `walk()`, immediately after the `visits++;` line (before `let lst;`), insert:

```ts
      const rp = path.resolve(dir);
      if (excludePaths.has(rp)) {
        hidden.add(rp);
        return;
      }
```

3e. In the child-descend loop, change the skip condition from `exclude.has(name)` to `excludeNames.has(name)`:

```ts
        if (INTRINSIC_SKIP.has(name) || excludeNames.has(name) || shouldSkipDirectory(name)) {
          continue;
        }
```

3f. Replace the `return { ... }` at the end of `discover()` with:

```ts
    return {
      projects: [...projects].sort(),
      hidden: [...hidden].sort(),
      skipped,
      rootsScanned,
    };
```

3g. In `server/src/__tests__/test-helpers.ts`, update the `resolveProjects` stub so the object satisfies the new `DiscoveryResult` shape and is exclude-aware (this also enables later route tests). Replace the existing `resolveProjects: async () => (...)` line with:

```ts
    resolveProjects: async () => {
      const ex = new Set(exclude.map((e) => path.resolve(e)));
      return {
        projects: scanDirs.filter((d) => !ex.has(path.resolve(d))),
        hidden: scanDirs.filter((d) => ex.has(path.resolve(d))),
        skipped: [],
        rootsScanned: 0,
      };
    },
```

(The `exclude` variable is added in Task 3 Step 3; this task only needs `hidden: []` semantics — with no exclude option yet, `exclude` does not exist. To keep Task 2 self-contained and the build green, for THIS task use the simpler form below and let Task 3 replace it:)

```ts
    resolveProjects: async () => ({
      projects: scanDirs,
      hidden: [],
      skipped: [],
      rootsScanned: 0,
    }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/__tests__/services/project-discovery.test.ts`
Expected: PASS (all, including the original suite).

- [ ] **Step 5: Build check**

Run: `cd server && npm run build`
Expected: tsc exits 0 (no type errors from the new `hidden` field).

- [ ] **Step 6: Commit**

```bash
git add server/src/services/project-discovery.ts server/src/__tests__/services/project-discovery.test.ts server/src/__tests__/test-helpers.ts
git commit -m "ProjectDiscovery: path-aware exclude, surface hidden projects"
```

---

### Task 3: Wire exclude get/set + validationPaths; rewrite DELETE to "hide"

**Files:**
- Modify: `server/src/app.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/__tests__/test-helpers.ts`
- Modify: `server/src/routes/directories.ts`
- Test: `server/src/__tests__/routes/directories.test.ts`

- [ ] **Step 1: Write/rewrite the failing tests**

In `server/src/__tests__/routes/directories.test.ts`, add `import path from 'path';` at the top. **Replace** the existing `describe('DELETE /api/directories', ...)` block entirely with:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npx jest src/__tests__/routes/directories.test.ts`
Expected: FAIL — `scanExclude` option unknown / DELETE still 400s "not in the scan list", `outside` not present.

- [ ] **Step 3: Add exclude state + threading**

3a. `server/src/__tests__/test-helpers.ts` — add to `TestAppOptions`:

```ts
  scanExclude?: string[];
```

Add, next to `let scanDirs = ...`:

```ts
  let exclude = options.scanExclude ?? [];
```

Add to the `deps` object (near `getScanDirectories`):

```ts
    getScanExclude: () => exclude,
    setScanExclude: (e: string[]) => { exclude = e; },
```

Replace the Task-2 placeholder `resolveProjects` with the exclude-aware version:

```ts
    resolveProjects: async () => {
      const ex = new Set(exclude.map((e) => path.resolve(e)));
      return {
        projects: scanDirs.filter((d) => !ex.has(path.resolve(d))),
        hidden: scanDirs.filter((d) => ex.has(path.resolve(d))),
        skipped: [],
        rootsScanned: 0,
      };
    },
```

3b. `server/src/app.ts` — add to the `AppDependencies` interface (after `setScanDirectories`):

```ts
  getScanExclude: () => string[];
  setScanExclude: (e: string[]) => void;
```

Replace the `createDirectoriesRouter(...)` call with:

```ts
  app.use(
    '/api',
    createDirectoriesRouter(
      deps.getScanDirectories,
      deps.setScanDirectories,
      deps.saveDirectories,
      deps.cacheManager,
      deps.getScanExclude,
      deps.setScanExclude,
      validationPaths
    )
  );
```

3c. `server/src/index.ts` — add after `setScanDirectories`:

```ts
function getScanExclude(): string[] {
  return scanExclude;
}

function setScanExclude(e: string[]): void {
  scanExclude = e;
}
```

Add to the `createApp({ ... })` deps object (after `setScanDirectories,`):

```ts
    getScanExclude,
    setScanExclude,
```

- [ ] **Step 4: Rewrite the DELETE handler + POST normalization**

In `server/src/routes/directories.ts`:

4a. Replace the imports block top of file:

```ts
import { Router } from 'express';
import fs from 'fs/promises';
import type { CacheManager } from '../services/cache-manager';
import { isPathWithinScanDirs, normalizeInputPath } from '../utils';
```

(The `path` import is removed — normalization now lives in `normalizeInputPath`.)

4b. Replace the function signature:

```ts
export function createDirectoriesRouter(
  getScanDirectories: () => string[],
  setScanDirectories: (dirs: string[]) => void,
  saveDirectories: () => Promise<void>,
  cacheManager: CacheManager,
  getExclude: () => string[],
  setExclude: (e: string[]) => void,
  validationPaths: () => string[]
): Router {
```

4c. In the POST handler, replace the whole normalization block (the `directory = directory.trim();` line, the `if (process.platform === 'linux') { ... }` block, the `if (directory.startsWith('~/')) { ... }` block, and `directory = path.resolve(directory);`) with the single line:

```ts
      directory = normalizeInputPath(directory);
```

4d. Replace the entire `router.delete('/directories', ...)` handler with:

```ts
  router.delete('/directories', async (req, res) => {
    try {
      const { directory } = req.body;

      if (!directory || typeof directory !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Directory path is required and must be a string',
        });
        return;
      }

      const target = normalizeInputPath(directory);

      if (!isPathWithinScanDirs(target, validationPaths())) {
        res.status(400).json({
          success: false,
          error: 'Path is outside the configured scan directories',
        });
        return;
      }

      const exclude = getExclude();
      if (!exclude.includes(target)) {
        exclude.push(target);
        setExclude(exclude);
        await saveDirectories();
        await cacheManager.invalidateCache();
      }

      console.log(`🙈 Hidden project: ${target}`);
      res.json({ success: true, message: 'Project hidden', excluded: target });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error hiding project:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx jest src/__tests__/routes/directories.test.ts`
Expected: PASS (the rewritten DELETE block + untouched POST/PUT/config tests).

- [ ] **Step 6: Build check**

Run: `cd server && npm run build`
Expected: tsc exits 0.

- [ ] **Step 7: Commit**

```bash
git add server/src/app.ts server/src/index.ts server/src/__tests__/test-helpers.ts server/src/routes/directories.ts server/src/__tests__/routes/directories.test.ts
git commit -m "Rewrite DELETE /directories to hide via path-exclude; wire exclude get/set"
```

---

### Task 4: Add `POST /api/directories/restore` (unhide)

**Files:**
- Modify: `server/src/routes/directories.ts`
- Test: `server/src/__tests__/routes/directories.test.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `server/src/__tests__/routes/directories.test.ts`:

```ts
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
      const app = createTestApp({ scanDirectories: [process.cwd()], scanExclude: [] });
      const res = await request(app)
        .post('/api/directories/restore')
        .send({ directory: process.cwd() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npx jest src/__tests__/routes/directories.test.ts -t restore`
Expected: FAIL — route returns 404 (not defined).

- [ ] **Step 3: Implement the route**

In `server/src/routes/directories.ts`, add this handler immediately after the `router.delete('/directories', ...)` handler:

```ts
  router.post('/directories/restore', async (req, res) => {
    try {
      const { directory } = req.body;

      if (!directory || typeof directory !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Directory path is required and must be a string',
        });
        return;
      }

      const target = normalizeInputPath(directory);

      if (!isPathWithinScanDirs(target, validationPaths())) {
        res.status(400).json({
          success: false,
          error: 'Path is outside the configured scan directories',
        });
        return;
      }

      const exclude = getExclude();
      const idx = exclude.indexOf(target);
      if (idx !== -1) {
        exclude.splice(idx, 1);
        setExclude(exclude);
        await saveDirectories();
        await cacheManager.invalidateCache();
      }

      console.log(`↩️ Restored project: ${target}`);
      res.json({ success: true, message: 'Project restored', restored: target });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error restoring project:', error);
      res.status(500).json({ success: false, error: msg });
    }
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/__tests__/routes/directories.test.ts`
Expected: PASS (all blocks).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/directories.ts server/src/__tests__/routes/directories.test.ts
git commit -m "Add POST /api/directories/restore to unhide a project"
```

---

### Task 5: Projects route — analyze hidden, mark `hidden`, report `hiddenCount`

**Files:**
- Modify: `server/src/types.ts`
- Modify: `server/src/routes/projects.ts`
- Test: `server/src/__tests__/routes/projects.test.ts`

- [ ] **Step 1: Write the failing test**

In `server/src/__tests__/routes/projects.test.ts`, add imports at the top:

```ts
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
```

Add inside `describe('Projects API', ...)`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npx jest src/__tests__/routes/projects.test.ts -t hiddenCount`
Expected: FAIL — `discovery.hiddenCount` is `undefined`, `projects[0].hidden` is `undefined`.

- [ ] **Step 3: Implement**

3a. `server/src/types.ts` — add to the `Project` interface (after `isScanned: boolean;`):

```ts
  hidden?: boolean;
```

3b. `server/src/routes/projects.ts` — replace the `DiscoverySummary` interface:

```ts
interface DiscoverySummary {
  rootsScanned: number;
  projectsFound: number;
  hiddenCount: number;
  skipped: DiscoveryResult['skipped'];
}
```

3c. Replace the body of `scanAllProjects()` with:

```ts
  async function scanAllProjects(): Promise<{ projects: Project[]; discovery: DiscoverySummary }> {
    const discovered = await resolveProjects();
    const allProjects: Project[] = [];

    const entries = [
      ...discovered.projects.map((p) => ({ p, hidden: false })),
      ...discovered.hidden.map((p) => ({ p, hidden: true })),
    ];

    for (const { p: projectPath, hidden } of entries) {
      try {
        const project = await projectAnalyzer.analyzeProject(projectPath, path.basename(projectPath));
        if (project) {
          project.hidden = hidden;
          allProjects.push(project);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Could not analyze ${projectPath}:`, msg);
      }
    }

    return {
      projects: allProjects,
      discovery: {
        rootsScanned: discovered.rootsScanned,
        projectsFound: allProjects.length,
        hiddenCount: allProjects.filter((p) => p.hidden).length,
        skipped: discovered.skipped,
      },
    };
  }
```

3d. In the `router.get('/projects/cached', ...)` handler, replace the `discovery` summary construction and the `stale` computation. Replace:

```ts
      const discovered = await resolveProjects();
      const discovery: DiscoverySummary = {
        rootsScanned: discovered.rootsScanned,
        projectsFound: discovered.projects.length,
        skipped: discovered.skipped,
      };

      const cacheCount = (cacheManager.cache.projects || []).length;
```

with:

```ts
      const discovered = await resolveProjects();
      const totalDiscovered = discovered.projects.length + discovered.hidden.length;
      const discovery: DiscoverySummary = {
        rootsScanned: discovered.rootsScanned,
        projectsFound: totalDiscovered,
        hiddenCount: discovered.hidden.length,
        skipped: discovered.skipped,
      };

      const cacheCount = (cacheManager.cache.projects || []).length;
```

And replace the `stale` expression's `cacheCount !== discovered.projects.length` term:

```ts
      const stale =
        forceRefresh ||
        !cacheManager.isCacheValid() ||
        cacheCount !== totalDiscovered ||
        (typeof ageMs === 'number' && ageMs > 120000);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/__tests__/routes/projects.test.ts`
Expected: PASS — both the original "out of sync" test (projectsFound still 1, scanning true) and the new hidden test.

- [ ] **Step 5: Full suite + build**

Run: `cd server && npm test && npm run build`
Expected: all suites green; tsc exits 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/types.ts server/src/routes/projects.ts server/src/__tests__/routes/projects.test.ts
git commit -m "Projects route: analyze + flag hidden projects, report hiddenCount"
```

---

### Task 6: Frontend — Show-hidden filter, badge, Unhide button

**Files:**
- Modify: `project-tracker.html`

No FE unit harness — verified manually in Step 6.

- [ ] **Step 1: Add CSS classes**

In `project-tracker.html`, immediately before the closing `</style>` (after the `.discovery-info { ... }` rule, ~line 240), add:

```css
        .project-card.is-hidden { opacity: 0.5; }
        .hidden-badge {
            display: inline-block;
            margin-left: 8px;
            padding: 1px 8px;
            font-size: 0.6em;
            border-radius: 10px;
            background: var(--button-secondary);
            color: var(--text-secondary);
            vertical-align: middle;
        }
        .show-hidden-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9em;
            color: var(--text-secondary);
            white-space: nowrap;
        }
```

- [ ] **Step 2: Add the "Show hidden" checkbox to the controls**

In the `<div class="controls">` block, insert this immediately **before** the `<input type="text" class="search-box" ...>` line:

```html
            <label class="show-hidden-toggle" title="Show projects you've hidden with Remove">
                <input type="checkbox" id="showHidden" onchange="filterProjects()"> Show hidden <span id="hiddenCount"></span>
            </label>
```

- [ ] **Step 3: Filter hidden projects unless toggled**

In `filterProjects()`, immediately after `const searchTerm = document.getElementById('searchInput').value.toLowerCase();`, add:

```js
            const showHidden = document.getElementById('showHidden')?.checked;
```

Then change the filter predicate return from:

```js
                return matchesSearch;
```

to:

```js
                return matchesSearch && (showHidden || !project.hidden);
```

- [ ] **Step 4: Card dimming, badge, and conditional action button**

In `renderProjects()`:

4a. Change the card open tag from:

```js
                <div class="project-card">
```

to:

```js
                <div class="project-card${project.hidden ? ' is-hidden' : ''}">
```

4b. Change the title line from:

```js
                    <div class="project-title">${escapeHtml(project.name)}</div>
```

to:

```js
                    <div class="project-title">${escapeHtml(project.name)}${project.hidden ? '<span class="hidden-badge">Hidden</span>' : ''}</div>
```

4c. Replace the Remove button line:

```js
                        <button class="action-btn ignore-btn" onclick="ignoreDirectory('${ePath}')" title="Remove this project from tracker">🚫 Remove</button>
```

with:

```js
                        ${project.hidden
                            ? `<button class="action-btn" onclick="unhideDirectory('${ePath}')" title="Unhide this project (removes it from the exclude list)">↩️ Unhide</button>`
                            : `<button class="action-btn ignore-btn" onclick="ignoreDirectory('${ePath}')" title="Hide this project — reversible via the Show hidden toggle">🚫 Remove</button>`}
```

- [ ] **Step 5: Add `unhideDirectory()` and tighten `ignoreDirectory()`**

5a. Replace the `ignoreDirectory` confirm/name lines. Change:

```js
                const projectName = projectPath.split('/').pop();
                const confirmMessage = `Are you sure you want to remove "${projectName}" from the tracker?\n\nThis will stop scanning: ${projectPath}`;
```

to:

```js
                const projectName = projectPath.split(/[\\/]/).pop();
                const confirmMessage = `Hide "${projectName}"?\n\nIt will be excluded from the list (reversible via the "Show hidden" toggle):\n${projectPath}`;
```

5b. Immediately after the `ignoreDirectory` function's closing brace, add:

```js
        async function unhideDirectory(projectPath) {
            try {
                const projectName = projectPath.split(/[\\/]/).pop();
                const res = await fetch(`${API_BASE_URL}/directories/restore`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ directory: projectPath })
                });
                const data = await res.json();
                if (data.success) {
                    showNotification(`↩️ Restored project: ${projectName}`, 'success');
                    setTimeout(() => refreshProjects(), 1000);
                } else {
                    showNotification(`❌ ${data.error}`, 'error');
                }
            } catch (error) {
                console.error('Error restoring directory:', error);
                showNotification('❌ Failed to restore directory', 'error');
            }
        }
```

5c. In `renderDiscoveryInfo(discovery)`, replace the block that appends the `📂 ... project ... from ... root` text node:

```js
            const found = Number(discovery.projectsFound) || 0;
            const roots = Number(discovery.rootsScanned) || 0;
            const skipped = Array.isArray(discovery.skipped) ? discovery.skipped : [];
            el.appendChild(document.createTextNode(
                `📂 ${found} project${found === 1 ? '' : 's'} from ${roots} root${roots === 1 ? '' : 's'}`
            ));
```

with:

```js
            const found = Number(discovery.projectsFound) || 0;
            const roots = Number(discovery.rootsScanned) || 0;
            const hiddenN = Number(discovery.hiddenCount) || 0;
            const visible = Math.max(found - hiddenN, 0);
            const skipped = Array.isArray(discovery.skipped) ? discovery.skipped : [];
            el.appendChild(document.createTextNode(
                `📂 ${visible} project${visible === 1 ? '' : 's'} from ${roots} root${roots === 1 ? '' : 's'}`
            ));
            const hc = document.getElementById('hiddenCount');
            if (hc) hc.textContent = hiddenN ? `(${hiddenN})` : '';
            if (hiddenN > 0) {
                el.appendChild(document.createTextNode(` · 🙈 ${hiddenN} hidden`));
            }
```

- [ ] **Step 6: Manual verification**

Run the server and open the page:

```bash
cd server && npm start
```

Open `project-tracker.html`. Verify, in order:
1. Pick a project, click **🚫 Remove**, confirm. It disappears from the list; a success toast shows; the `📂` line shows `🙈 1 hidden` and the toggle shows `(1)`.
2. Check **Show hidden**. The removed project reappears, dimmed, with a **Hidden** badge and an **↩️ Unhide** button (no Remove button).
3. Click **↩️ Unhide**. Toast shows "Restored"; after refresh the card returns to normal (no badge, Remove button back), hidden count returns to 0.
4. Confirm a different project sharing no path is unaffected throughout.
5. Uncheck **Show hidden** with nothing hidden — list unchanged.

- [ ] **Step 7: Commit**

```bash
git add project-tracker.html
git commit -m "Frontend: Show-hidden filter, Hidden badge, Unhide button"
```

---

### Task 7: Docs + session log

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `docs/SESSION_LOG.md`

- [ ] **Step 1: README endpoint list**

In `README.md`, under `## API Endpoints`, after the line:

```
- `DELETE /api/directories` - Remove a directory pin
```

change that line and add the restore line so the two read:

```
- `DELETE /api/directories` - Hide a project (adds its path to the exclude list)
- `POST /api/directories/restore` - Unhide a project (removes its path from exclude)
```

In the `### Scanning` section, append a sentence to the paragraph that ends "...A legacy `{ "directories": [...] }` file still works unchanged.":

```
The 🚫 Remove button hides a single project by adding its full path to `exclude`; hidden projects are off by default and revealed via the "Show hidden" toggle, where each has an ↩️ Unhide action.
```

- [ ] **Step 2: CLAUDE.md**

In `CLAUDE.md`, under `### Configuration`, change:

```
- `DELETE /api/directories` - Remove directory
```

to:

```
- `DELETE /api/directories` - Hide a project: adds its normalized path to `exclude` (path-containment validated)
- `POST /api/directories/restore` - Unhide a project: removes its path from `exclude`
```

Under `## Key Behaviors`, add a bullet after the `isPathWithinScanDirs` bullet:

```
- `exclude` entries are matched by **basename** (relative entries — manual config-noise filters, never surfaced) **or full resolved path** (absolute entries — added by 🚫 Remove). Path-excluded projects are returned by `/api/projects` flagged `hidden:true` with `discovery.hiddenCount`, hidden in the UI by default, revealable + un-hideable via the "Show hidden" toggle. Removing never deletes a pin — it masks via `exclude` so the action is fully reversible.
```

- [ ] **Step 3: Session log entry**

In `docs/SESSION_LOG.md`, insert immediately after the `Newest entries first.` / `---` header (before the existing `## 2026-05-16 → 2026-05-18` entry):

```markdown
## 2026-05-18 — Fix the dead 🚫 Remove button (hide via path-exclude + filter)

The per-project Remove button was a no-op for ~all projects: it issued
`DELETE /api/directories` which only deleted exact `directories` pins, but
after Pillar-1 root-discovery nearly all projects are discovered, not pinned
— so it 400'd "Directory is not in the scan list". Regression from the
discovery refactor (the directories mutation route was never re-wired; the
`exclude` list was loaded/saved but mutated by nothing).

Fix (spec: `docs/superpowers/specs/2026-05-18-remove-button-fix-design.md`):
single reversible model — Remove adds the project's resolved full path to
`exclude` (no pin-deletion branch; a removed pin lingers, masked).
`ProjectDiscovery` now splits `exclude` into basename entries (silent skip,
unchanged) vs absolute-path entries (surfaced in a new `hidden` list).
`DELETE /api/directories` rewritten (normalize + path-containment + add to
exclude, idempotent); new `POST /api/directories/restore` (unhide). Shared
`normalizeInputPath` helper extracted (POST/DELETE/restore consistent;
DELETE previously skipped normalization). Projects route analyzes hidden
too, flags `hidden:true`, reports `discovery.hiddenCount`; cached-endpoint
stale math updated for the larger set. Frontend: default-off "Show hidden
(N)" toggle, dimmed card + Hidden badge, per-card ↩️ Unhide. Git/Claude
pages exclude hidden naturally (they iterate `projects`, not `hidden`).
Backend fully TDD'd; all suites green.
```

- [ ] **Step 4: Final full verification**

Run: `cd server && npm test && npm run build`
Expected: all suites pass; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md docs/SESSION_LOG.md
git commit -m "Docs + session log: Remove-button hide/restore + filter"
```

---

## Self-Review

**Spec coverage:**
- Path-aware exclude, surface hidden → Task 2. ✓
- DELETE = add resolved path to exclude, no pin branch, idempotent, containment → Task 3. ✓
- New `POST /api/directories/restore` → Task 4. ✓
- Shared `normalizeInputPath` used by POST + DELETE + restore → Task 1, used in Tasks 3 & 4. ✓
- Wiring (`getScanExclude`/`setScanExclude`, validationPaths into directories router, test-helpers) → Task 3. ✓
- Projects route: analyze hidden, `hidden:true`, `hiddenCount`, cached stale math → Task 5. ✓
- `types.ts` `Project.hidden`; `DiscoveryResult.hidden` → Tasks 5 & 2. ✓
- Frontend default-off "Show hidden (N)", dimmed + badge, conditional Unhide, honest tooltips, discovery-info hidden count → Task 6. ✓
- Basename excludes stay silent/invisible → Task 2 test asserts it. ✓
- Docs + session log → Task 7. ✓
- All existing suites stay green → verified Task 5 Step 5 / Task 7 Step 4; existing `projects.test.ts` invariant (projectsFound=1, scanning) preserved by `totalDiscovered` math. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. The only intentional two-step is Task 2 Step 3g (placeholder `resolveProjects` replaced in Task 3 Step 3a) — both forms are written out in full, not described.

**Type consistency:** `DiscoveryResult.hidden: string[]` (Task 2) consumed as `discovered.hidden` (Tasks 3 helper, 5). `DiscoverySummary.hiddenCount` (Task 5) emitted by route, read as `discovery.hiddenCount` (frontend Task 6). `normalizeInputPath(input, platform?)` signature (Task 1) called as `normalizeInputPath(directory)` (Tasks 3, 4). `getScanExclude`/`setScanExclude` defined in `AppDependencies` (Task 3 3b), provided by index.ts (3c) and test-helpers (3a), consumed by `createDirectoriesRouter(... getExclude, setExclude, validationPaths)` (Task 3 4b). `Project.hidden?: boolean` (Task 5) set in scanAllProjects, read in frontend. Consistent throughout.

**Deviation note:** WSL-conversion is verified by the pure `normalizeInputPath` unit test (Task 1) rather than a route test, because `path.resolve` of a `/mnt/...` string is host-platform-dependent and can't be asserted literally cross-platform from a supertest route test. The spec's intent ("DELETE applies WSL/`~` normalization") is satisfied — DELETE calls the same helper the unit test pins.
