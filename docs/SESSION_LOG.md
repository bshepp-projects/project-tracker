# Session Log

A running, reverse-chronological record of *what changed and why* per work
session. Distinct from `CHANGELOG.md` (user-facing release notes): this is the
engineering trail, including missteps and decisions, for tracking how the
project got to its current state.

Newest entries first.

---

## 2026-05-16 → 2026-05-18 — Evaluation, security hardening, scanning + action redesign

Single extended session. Branch work lives on
`feature/scan-discovery-and-local-actions` (Pillars 1–4); the security fixes
were merged to `main` via PR #2.

### Deep evaluation
Five parallel review agents assessed backend, frontend, docs, tests, and
security. Findings independently verified before action. Key results: a real
command-injection vector, a guaranteed UI `ReferenceError`, brittle scanning,
"buttons that lie", and personal filesystem paths committed to a **public**
repo.

### Security & bug fixes — PR #2 (merged to `main`)
- **Command injection (critical):** `GitAnalyzer` rebuilt — the old
  shell-string form (interpolating `cd "$path" && git …` into a shell)
  replaced with `execFile` + an argv array and `cwd` (same for the `gh`
  call). Cross-shell regression test added; the failure was observed on the
  real vulnerable code first. Commits `cbc3581`, `947a0b7`.
- **CORS** narrowed from wildcard to a localhost/`null`/no-Origin allowlist.
- **Path containment:** `isPathWithinScanDirs` now guards tags/favorites paths.
- **`shouldSkipDirectory`** de-duplicated into `utils.ts`; this also fixed the
  `git.ts` copy that was missing the dot-dir clause.
- **UI crash:** `project-tracker.html` referenced undefined `projects` instead
  of `projectsData` on single-project refresh.
- **Privacy (future):** `directories.json` untracked + gitignored, sanitized
  `directories.example.json` added, `.gitignore` widened to `*.bak.*`.
- Merged via PR #2 (CI green).

### Public git-history scrub — **partial, by user decision**
- `git filter-repo` removed `server/directories.json` and
  `server/projects-cache.json` from all history; force-pushed; merged feature
  branch deleted; local clone resynced. Verified 0 occurrences in a fresh
  clone. Offline backup kept at `../pt-backup.git`.
- **Residual, accepted:** the personal directory taxonomy still exists in
  *old, pre-public-release* HTML history. User chose to stop history rewrites
  ("accept residual") — folder names were public long enough to assume
  indexed. No further rewrites without an explicit request.
- **Incident:** local `server/directories.json` was lost during scrub prep
  (a careless `checkout`/`pull` ordering). Recovered from the backup mirror;
  only uncommitted tweaks (a regenerable list) were unrecoverable. Lesson
  recorded: match effort/ceremony to a personal project's stakes.

### Magus deployment update
`~/project-tracker` on Magus (10.0.0.48) is a **non-git file copy** behind
nginx `/tracker/`, run by systemd from `dist/`. Patched the vulnerable
`git-analyzer.ts` + the `projectsData` fix, rebuilt, restarted; preserved
Magus's deploy-specific `shared.js` (`API_BASE_URL=/tracker/api`). Verified
end-to-end. The scrub does not affect Magus (not a git repo).

### Pillar 1 — Root-discovery scanning
`ProjectDiscovery` service (commit `0154189`): walks configured `roots` to
`maxDepth`, identifies projects by marker, stops descent there, honors pins /
exclude / intrinsic skips, symlink/cycle-safe, visit-capped; missing paths
reported in `skipped`. Wired into config + projects/git/claude/tags routes
(commit `e8897af`); UI banner added. Backward compatible with the legacy
`{ directories: [...] }` shape. Local `directories.json` derived from the old
68 brittle paths into 10 roots + 2 pins → **91 projects discovered, 0
skipped** (root cause of "only ~25 projects" resolved). Design spec:
`docs/superpowers/specs/2026-05-17-scan-discovery-and-local-actions-design.md`.

### Pillar 2 — Localhost-gated action bridge
`buildActionCommand` pure builder + `isLoopbackAddress` (commit `847ae30`);
`/api/actions/:action` + `/api/actions/status` router (commit `8d93040`).
Triple gate: `ENABLE_LOCAL_ACTIONS` flag **and** loopback host bind **and**
loopback request — provably inert on a `0.0.0.0`/remote box (explicit test).
Allowlisted actions only, path validated, processes started with no shell.
Frontend buttons now actually execute when enabled, else fall back to an
honest "copied (local actions off)". Verified live end-to-end.

### Pillar 3 — Docs honesty
`README.md`, `CLAUDE.md`, `DEPLOYMENT.md`, frontend instructions corrected to
the real scanning model and the action-bridge security model; stale claims
removed. Commit `ac5c2c2`.

### Pillar 4 — This session log
Added `docs/SESSION_LOG.md` (this file).

**State at session end:** `main` has the security fixes (history rewritten).
`feature/scan-discovery-and-local-actions` (Pillars 1–4) is ready for review,
not yet pushed or merged. Test suite 125/125, 15 suites. Deferred by choice:
`#6` (health-endpoint version sync, untested git/claude/projects route
suites), trimming Magus's stale `directories.json`, and any further
git-history rewrite.
