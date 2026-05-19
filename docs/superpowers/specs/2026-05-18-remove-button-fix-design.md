# Design: Fix the 🚫 Remove button (hide via path-exclude + "Show hidden" filter)

- **Date:** 2026-05-18
- **Status:** Approved (design shape) — pending written-spec review
- **Branch:** `fix/remove-button-hide-filter` (off `main`)

## 1. Context & Problem

The per-project **🚫 Remove** button on `project-tracker.html` is dead for
essentially every project on screen.

Trace:

1. `project-tracker.html:502` → `ignoreDirectory(ePath)` (`:962`) sends
   `DELETE /api/directories` with `{ directory: <full project path> }`.
2. `routes/directories.ts` DELETE looks the path up in `getScanDirectories()`
   and 400s with `"Directory is not in the scan list"` if absent.
3. `getScanDirectories()` (`index.ts:42`) returns **only the `directories`
   pins**, not roots and not discovered projects.

The current config has 10 `roots` and 2 pins, so the ~91 projects are
*discovered* by walking roots — their paths are never in the pins list →
every Remove click on a discovered project 400s and shows
`❌ Directory is not in the scan list`. Only an exact-string-matching pin can
be removed, and DELETE doesn't even apply the `path.resolve`/WSL normalization
that POST does.

**Root cause:** regression from the Pillar-1 root-discovery refactor. The
button + endpoint were built for the old "one configured directory = one
project" model. After discovery landed, projects come from `roots`, the
directories route still only mutates pins, and `scanExclude` is loaded/saved
but **never mutated by any route** — there is no API to hide a discovered
project.

## 2. Goals / Non-Goals

**Goals**

1. Make 🚫 Remove actually hide any project (discovered or pinned),
   precisely (only that project, not every same-named folder).
2. Make the operation fully reversible from the UI: hidden projects are
   excluded from the list by default but can be revealed via a filter toggle
   and individually un-hidden.
3. Keep existing manual basename excludes (config-noise filters) working and
   invisible — the filter must not resurrect them.
4. TDD the backend; keep all existing tests green.

**Non-Goals**

- A dedicated "manage hidden projects" modal. Reveal-via-filter + per-card
  Unhide is the entire UX.
- Frontend unit tests (no FE test harness exists). Frontend logic stays
  minimal and manually verifiable.
- Any Magus-specific behavior. The directories route already ran on Magus
  pre-change; parity holds. Standard redeploy caveat applies (preserve
  Magus's `shared.js` `API_BASE_URL` — a deploy step, not a code change).
- Authentication / new security model. Reuses the existing
  `isPathWithinScanDirs` containment posture.

## 3. Design

### 3.1 Mental model

**Remove = add the project's resolved full path to `exclude`.
Unhide = strip that path back out.** One reversible operation, no special
cases.

Deliberately **no pin-deletion branch**: a removed project that is also a pin
stays in `directories.json` but is masked by the path-exclude. The pin entry
lingers (harmless, redundant config on a personal tool) in exchange for a
single symmetric, fully reversible model.

### 3.2 `ProjectDiscovery` — path-aware exclude, surface hidden

`config.exclude` is split by `path.isAbsolute(entry)`:

- **relative entry → `excludeNames`** (`Set<string>`): basename skip during
  descent — current behavior, unchanged. **Silent, never surfaced.** These
  are deliberate config-noise filters; the filter must not resurrect every
  such folder.
- **absolute entry → `excludePaths`** (`Set<string>` of `path.resolve`d
  paths): these are *hidden projects* — discovered/known but masked.

Changes to `discover()`:

- New result field: `hidden: string[]` on `DiscoveryResult`.
- At the **top of `walk(dir, depth)`**, before the marker check:
  ```ts
  const rp = path.resolve(dir);
  if (excludePaths.has(rp)) { hidden.add(rp); return; }
  ```
  This uniformly covers a hidden project at any depth, including a root that
  is itself a project. `return` ensures no descent into a hidden project.
- **Pin loop:** if a resolved pin ∈ `excludePaths` → push to `hidden`
  instead of `projects` (pins currently ignore exclude entirely — this is
  part of the bug).
- **Child descend loop:** unchanged except it now consults `excludeNames`
  (the relative split) for the basename skip.
- `hidden` is returned sorted, deduped (a `Set`), like `projects`.

Backward compatible: every existing `exclude` entry today is a basename
(relative) → lands in `excludeNames` → identical behavior.

### 3.3 Routes

A shared helper `normalizeInputPath(input: string): string` is extracted
(WSL drive→`/mnt` conversion + `~/` expansion + `path.resolve`) and used by
**both** the existing POST and the new/changed handlers. Today only POST
normalizes; DELETE's raw exact-match is brittle — this fixes it en route.

- **`DELETE /api/directories` (hide)** — rewritten:
  1. Validate `directory` is a non-empty string (else 400).
  2. `p = normalizeInputPath(directory)`.
  3. Containment: `isPathWithinScanDirs(p, validationPaths())` — else 400
     (DELETE has no containment check today; this aligns it with
     tags/favorites/actions).
  4. If `p` not already in `exclude` → add it; `setExclude` + `saveDirectories`.
  5. `cacheManager.invalidateCache()`.
  6. Idempotent: already excluded → still `{ success: true }`.
  7. Response shape stays `{ success: true, ... }` so the existing frontend
     `deleteData.success` path is unchanged.

- **`POST /api/directories/restore` (unhide)** — new:
  1–3 same as above (validate, normalize, containment).
  4. If `p` is in `exclude` → remove it; `setExclude` + `saveDirectories`.
  5. `invalidateCache()`. Idempotent: not present → still `{ success: true }`.

### 3.4 Wiring

`createDirectoriesRouter` signature gains:

- `getExclude: () => string[]`, `setExclude: (e: string[]) => void`
- `validationPaths: () => string[]` (the same
  `[...getScanDirectories(), ...getProjectRoots()]` closure already built in
  `app.ts:52` and threaded to tags/favorites/actions).

`index.ts` already holds `scanExclude` and persists it via
`saveDirectoriesToFile` (no persistence change). Add `getScanExclude` /
`setScanExclude` mirroring `getScanDirectories`/`setScanDirectories` and pass
them + `validationPaths` through `AppDependencies` → `createDirectoriesRouter`.

### 3.5 `routes/projects.ts`

- Analyze `projects` **∪** `hidden`. Each analyzed project originating from
  `hidden` is tagged `hidden: true` (visible ones `hidden: false`/absent).
- `discovery` summary gains `hiddenCount: number`.
- Hidden projects are cached like any other (frontend filters; cache
  invalidated on hide/restore).

Type changes: `DiscoveryResult` (defined in `project-discovery.ts`) gains
`hidden: string[]`. `types.ts` adds `hidden?: boolean` to the project type and
`hiddenCount` to the API `discovery` summary shape.

### 3.6 Frontend (`project-tracker.html`)

- Project objects carry `hidden: boolean`.
- Filter bar: a **"Show hidden (N)"** checkbox, **default unchecked**. `N` =
  `discovery.hiddenCount`. `filterProjects()` drops projects with
  `hidden === true` unless the box is checked.
- When shown, a hidden card renders **dimmed with a "Hidden" badge**
  (page-specific CSS class; no inline styles — consistent with commit
  `55ffd81`).
- Per-card action button is conditional:
  - not hidden → existing **🚫 Remove** → `ignoreDirectory(path)` →
    `DELETE /api/directories`.
  - hidden → **↩️ Unhide** → new `unhideDirectory(path)` →
    `POST /api/directories/restore`; on success, refresh.
- Tooltips updated to be honest ("Hide this project — reversible via the
  Show hidden filter").
- `ignoreDirectory` notification text already accurate; keep its
  confirm-dialog flow.

## 4. Testing (TDD)

Backend is fully test-driven; write the failing test first in each case.

- **`project-discovery.test.ts`:**
  - absolute `exclude` entry → that project in `hidden`, not `projects`;
    a same-basename sibling under another root stays in `projects`.
  - relative `exclude` entry → directory silently skipped, **not** in
    `hidden` (config-noise stays invisible).
  - an excluded **pin** → in `hidden`, not `projects`.
  - `hidden` sorted/deduped; `rootsScanned`/`skipped` unaffected.
- **`routes/directories.test.ts`:**
  - DELETE non-pin discovered path → `success`, path present in saved
    `exclude`.
  - DELETE with path outside scan dirs → 400 (containment).
  - DELETE idempotent (second call still `success`, no dup in `exclude`).
  - DELETE applies WSL/`~` normalization (linux-path branch).
  - `POST /restore` removes the path from `exclude`; idempotent when absent;
    containment 400 outside scan dirs.
- **`routes/projects.test.ts`:** hidden projects present in the response with
  `hidden: true`; `discovery.hiddenCount` correct; visible projects unmarked.
- **`test-helpers.ts`:** thread exclude get/set + `validationPaths` into the
  directories router factory used by tests.
- All existing suites stay green; CI unchanged.

Frontend has no unit harness — verify manually: Remove a project → it
disappears; toggle "Show hidden" → it reappears dimmed with Unhide; Unhide →
it returns to normal; same-named project elsewhere never affected.

## 5. Risks & Mitigations

- **Removed pin lingers in `directories.json` (masked).** Accepted: keeps the
  model symmetric and reversible; redundant config is harmless on a personal
  tool. Documented here and in the session log.
- **Analyzing the hidden set adds work to `/api/projects`.** The hidden set is
  small (only what the user explicitly removed); negligible. Cached like the
  rest.
- **Path string equality across OS.** Mitigated by routing every input
  through the shared `normalizeInputPath` + `path.resolve`, and discovery
  comparing `path.resolve`d paths on both sides.

## 6. Rollout

1. Backward compatible: legacy/basename `exclude` entries behave exactly as
   before; no config migration.
2. Local workstation: behavior available immediately after build.
3. Magus: standard redeploy (file copy + build + restart); preserve its
   `shared.js` `API_BASE_URL`. No Magus-specific code.
4. Append a `docs/SESSION_LOG.md` entry when the work lands.
