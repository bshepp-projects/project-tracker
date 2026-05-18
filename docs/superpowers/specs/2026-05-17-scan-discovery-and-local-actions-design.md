# Design: Root-Discovery Scanning + Local Action Bridge

- **Date:** 2026-05-17
- **Status:** Approved (design shape) — pending written-spec review
- **Branch:** `feature/scan-discovery-and-local-actions`

## 1. Context & Problem

Project Tracker currently:

- Scans a hand-maintained list of ~68 exact project paths (`server/directories.json`),
  treating **one configured directory = one project**. It does not discover
  sub-projects. Paths that don't exist on the host are **silently dropped**
  (server log only) — the live Magus instance shows 29 of 68 because 39 paths
  are stale Windows paths copied to a Linux box. This is the "why only ~25
  projects" symptom: brittle, manual, and silent about failure.
- Ships action buttons (📁 Open, 🤖 Claude, 💀 YOLO, 🐍 Venv) whose labels imply
  they act on the machine, but they only **copy a shell command to the
  clipboard**. The code itself comments "in the future this will integrate with
  a backend service." The buttons lie.

User has confirmed two priorities: **(a) scanning is dumb/brittle**, **(b) dead
buttons that lie**. Primary usage is the **local workstation** (browser, files,
and terminal on the same machine), with Magus as an always-on read-only
dashboard.

## 2. Goals / Non-Goals

**Goals**

1. Replace the brittle exact-path list with low-maintenance **root auto-discovery**,
   while staying backward compatible with the existing config.
2. Surface in the UI what was discovered vs. skipped (no more silent loss).
3. Make the action buttons **genuinely execute** on the local workstation, via a
   safe, allowlisted, localhost-gated bridge; degrade honestly when disabled.
4. Bring docs in line with reality.
5. Add a session log to track changes going forward.

**Non-Goals (out of scope)**

- Turning the tracker into a general control panel (user explicitly did not pick this).
- `#6` health-endpoint version sync, git-history re-scrub, cleaning Magus's
  `directories.json` *content* — all tracked separately.
- Authentication. The security model here is **localhost gating**, not auth.
- Remote (Magus) execution of actions — explicitly inert there by design.

## 3. Pillar 1 — Root-Discovery Scanning

### 3.1 Config schema (backward compatible)

`server/directories.json` gains optional keys; the old shape keeps working:

```jsonc
{
  "roots":   ["F:\\art-projects", "F:\\utility-projects"], // NEW: parents to auto-scan
  "exclude": ["node_modules", ".git", "venv", "__pycache__", "dist", "archive_family"],
  "directories": ["F:\\one-off\\explicit-project"],         // LEGACY/pins: explicit roots
  "maxDepth": 3,                                             // NEW, optional (default 3)
  "lastUpdated": "..."
}
```

- **Migration:** if only legacy `directories` is present, behavior is unchanged
  except missing entries are now *reported* rather than silently dropped. No
  migration step is forced; Magus keeps working untouched.
- The effective project set = (auto-discovered under each `roots` entry) ∪
  (each existing `directories` pin) − (anything matching `exclude`).

### 3.2 Discovery algorithm

New isolated service `server/src/services/project-discovery.ts`:

- **Input:** roots[], exclude[], maxDepth. **Output:** `{ projects: string[],
  skipped: {path,reason}[] }`.
- For each root: bounded DFS to `maxDepth`. A directory is a **project** if it
  contains any **marker**: `.git/`, `package.json`, `pyproject.toml`,
  `requirements.txt`, `Cargo.toml`, `go.mod`, `CLAUDE.md`.
- **Stop descending once a directory is identified as a project** (no
  nested-project explosion).
- Skip any directory whose basename is in `exclude` or matched by the existing
  `shouldSkipDirectory` util. Discovery does **not** follow directory symlinks
  and tracks visited inodes to be cycle-safe. (This is new, correct behavior in
  the discovery service — the legacy recursive scan did *not* guard symlinks;
  that gap is closed here, scoped to discovery only.)
- Missing/inaccessible roots or pins are collected into `skipped` with a reason
  (`ENOENT`, `EACCES`, …) — **never silently dropped**.
- A hard cap on total directories visited (e.g. 5000) as a DoS/footgun guard.

`routes/projects.ts`, `routes/git.ts`, `routes/claude.ts`, `routes/tags.ts`
switch from "iterate `directories`" to "iterate discovered project set". The
per-project analysis (`ProjectAnalyzer.analyzeProject`) is unchanged.

### 3.3 Surfacing found vs skipped

Scan API responses (`/api/projects`, `/api/projects/cached`) add:

```jsonc
"discovery": { "rootsScanned": 2, "projectsFound": 41,
               "skipped": [{ "path": "F:\\old\\gone", "reason": "ENOENT" }] }
```

Frontend: a compact, dismissible banner/stat — e.g. `41 projects from 2 roots ·
3 configured paths unavailable (hover for list)`. No layout redesign.

## 4. Pillar 2 — Local Action Bridge

### 4.1 Endpoint

`POST /api/actions/:action` with body `{ projectPath }`.

- `:action` ∈ fixed allowlist: `open-folder`, `launch-claude`,
  `launch-claude-yolo`, `activate-venv`, `open-terminal`.
- The client **never sends a command** — only the action name + path. The
  server builds the command from a per-OS template.

### 4.2 Security gating (all must hold, else `403 {actionsDisabled:true}`)

1. Env flag `ENABLE_LOCAL_ACTIONS` is truthy.
2. Request origin is loopback (`req.socket.remoteAddress` ∈ `127.0.0.1`/`::1`).
3. Configured `HOST` is a loopback address (defense in depth — refuses even if
   the flag were set on a `0.0.0.0` box like Magus).
4. `projectPath` passes the existing `isPathWithinScanDirs` check.

Command execution uses `execFile`/`spawn` (no shell), `detached` for GUI
launches, args as an array — consistent with this session's injection fix. There
is **no path from client input to a shell string**.

### 4.3 OS-aware command templates (pure, unit-tested builder)

`buildActionCommand(action, projectPath, platform) -> { file, args }`:

| action | Windows | Linux | macOS |
|---|---|---|---|
| open-folder | `explorer <path>` | `xdg-open <path>` | `open <path>` |
| open-terminal | `wt -d <path>` (fallback `cmd`) | `x-terminal-emulator` (fallbacks) | `open -a Terminal <path>` |
| launch-claude | open the OS terminal in `<path>` running `claude` | same, via the OS terminal | same, via the OS terminal |
| launch-claude-yolo | same as launch-claude but `claude --dangerously-skip-permissions` | same | same |
| activate-venv | (all platforms) returns the OS-correct activate command for the clipboard — cannot inject into the user's shell, so this action stays copy-style even when local actions are enabled, just honestly labelled |

`activate-venv` is explicitly acknowledged as not truly "executable" (can't
inject into the user's shell); it remains a copy action but OS-correct and
honestly labelled.

### 4.4 Frontend behavior + honest fallback

- On load, frontend probes capability (extend `/api/health` →
  `{ localActions: bool }`).
- `localActions: true` → buttons POST to the action endpoint; on success show
  "✅ Launched".
- `localActions: false` (Magus, or flag off) → current clipboard behavior, with
  tooltip suffix `(copies command — local actions disabled)`. Labels become
  truthful in both modes.

## 5. Pillar 3 — Documentation

Update to match reality: `README.md`, `CLAUDE.md`, `DEPLOYMENT.md`,
`.github/instructions/frontend-html.instructions.md`:

- New scanning model (roots/exclude/pins, depth, discovery output).
- Local actions: the `ENABLE_LOCAL_ACTIONS` flag, the localhost-only security
  model, and that actions are inert on remote/Magus deployments by design.
- Remove/replace stale claims (one-dir-one-project; buttons "launch").

## 6. Pillar 4 — Session Log

Add `docs/SESSION_LOG.md` — reverse-chronological dated entries of *what changed
and why* (distinct from the user-facing `CHANGELOG.md`). Seed with a backfilled
entry covering this session: command-injection fix, CORS/path-validation,
`shouldSkipDirectory` dedupe, public-history scrub (partial by decision), Magus
deploy, and this redesign. Going forward, each work session appends an entry.

## 7. Testing (TDD)

- **Discovery (unit):** temp dir trees — marker detection, depth bound, exclude,
  nested project not double-counted, missing/inaccessible root surfaced in
  `skipped`, visit cap. Pure where possible.
- **Action security (unit/route):** 403 when flag off / non-loopback /
  HOST non-loopback / path outside scan dirs / unknown action. **A test that
  asserts actions are inert under Magus-like config (`HOST=0.0.0.0`).**
- **Command builder (unit):** `buildActionCommand` returns correct `{file,args}`
  per platform; never returns a shell string; path is an arg, not interpolated.
- Execution itself is dependency-injected (a spawn runner) so tests assert the
  invocation without launching real processes.
- All existing tests must stay green; CI unchanged.

## 8. Risks & Mitigations

- **Re-introduces local command execution by design.** Mitigated by: off by
  default, triple gate (flag + loopback + HOST), allowlist, no shell, path
  validation, and an explicit test proving Magus inertness.
- **GUI/terminal launches need a desktop session** — acceptable: feature targets
  the local workstation; headless contexts simply see the launch no-op or error,
  reported back to the UI.
- **Discovery performance** on huge trees — bounded depth + visit cap + existing
  skip rules; discovery is independent of per-project git analysis.

## 9. Rollout

1. Land behind no behavior change for legacy config (backward compatible).
2. Magus: redeploy as today (file copy + build + restart); flag stays unset →
   actions inert, scanning still works (legacy `directories` honored, now with
   skip reporting). Update Magus `directories.json` to `roots` is a *separate,
   optional* follow-up.
3. Local workstation: set `ENABLE_LOCAL_ACTIONS=1`, switch config to `roots`.
