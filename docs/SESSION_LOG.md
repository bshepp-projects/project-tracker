# Session Log

A running, reverse-chronological record of *what changed and why* per work
session. Distinct from `CHANGELOG.md` (user-facing release notes): this is the
engineering trail, including missteps and decisions, for tracking how the
project got to its current state.

Newest entries first.

---

## 2026-07-19 — Claims audit + fixes for what failed it

Full does-it-do-what-it-advertises audit: every README/CLAUDE.md claim
checked against code (two parallel review agents) and against a live local
server (all 19 endpoints exercised; hide/restore, favorites, path-
containment 403s, action-bridge gate, CORS allowlist, cache self-heal all
verified working). Core claims hold. Fixed the clear-cut failures:

- **README button** on the main page was a `ReferenceError`
  (`copyToClipboard` only existed in claude-tracker) — promoted to
  shared.js. Also removed the phantom `toggleFilter('all')` init call.
- **Escape** now closes any open modal on all three pages (was: directory
  modal only; git-tracker had no handler).
- **Unescaped innerHTML** interpolations in git/claude tracker cards
  (githubActions workflowName/lastRun, counts, dates) now escaped.
- **Corrupt `directories.json` is no longer silent**: parse failures are
  injected into `discovery.skipped` (surfaces in the UI banner), a leading
  UTF-8 BOM (PowerShell's default) is tolerated, and saves refuse to
  overwrite an unparseable file. Found live: a BOM'd config had the local
  tracker running on zero roots. Tests 145/145.

**Round 2 (same day) — secondary-page parity.** The design-decision gaps
were resolved in favor of parity:

- **Real tag editing everywhere**: a generic tag manager now lives in
  `shared.js` (vocabulary + per-project assignment from `/projects/cached`,
  saves via `POST /projects/:path/tags`); claude/git-tracker use it via a
  `tagManagerItems()` hook (their stub modals + alert-only saves deleted —
  those pages' Add-Tag buttons had been calling functions that didn't even
  exist). The main page keeps its own richer implementation, which
  overrides the shared functions by declaration order.
- **claude-tracker launch buttons use the bridge**: launchClaude/YOLO/
  activateVenv now go through `runProjectAction` (execute when enabled,
  honest copy otherwise). git-tracker's fetch/pull/push stay copy-only by
  design (not bridge actions) — their labels already said so.
- **claude-tracker favorites sync to the server** (POST/DELETE + load on
  init, localStorage fallback), matching the main page.
- **claude-tracker 🚫 Ignore → 🚫 Hide**: hides the single project via
  path-exclude (reversible from the main page's Show-hidden toggle). The
  old code deleted the parent scan entry — and had been dead since
  root-discovery anyway (it only matched pins).
- **claude-tracker fallback honesty**: sample data only when nothing is
  loaded, labeled as sample data, not as a cache.
- **`DELETE /api/favorites` path-validated** — with a carve-out so
  favorites orphaned by a config change stay deletable. Tests 147/147.

**Round 3 (same day) — last audit stragglers.**
`GET /api/config` now returns the full scan config (pins + roots +
exclude + maxDepth; old keys kept for compatibility). README/engines
corrected to Node 18+ (the compiled server runs on 16, but tsx/jest need
18). New `claude.test.ts` route suite (marker detection, CLAUDE.md
metadata + .claude permissions, hidden-project exclusion) — every route
now has a test file. 151/151 across 18 suites.

**Remaining (machine-side only):** magus IP pin back to .48, nginx
`/tracker/` include not in the sentinel template, Scree redeploy. The
project itself has no known gaps against its documentation.

---

## 2026-07-18 — Catch-up: version sync, proxy-aware API base, magus redeploy

Post-hiatus session. Closed the deferred health-endpoint version sync
(`/api/health` now reads `version` from `package.json`; was hardcoded 1.7.0
vs 2.0.0) and made `shared.js` derive `API_BASE_URL` from the page origin:
file:// and localhost keep `http://localhost:3001/api`; any other host
resolves `./api` relative to the page, so a reverse-proxied deploy no longer
needs a hand-edited `shared.js`. Tests 141/141.

**Magus redeploy from scratch.** The old magus deploy no longer exists — the
box died (PSU) and was rebuilt on Debian 13 (see
`F:\utility-projects\machines\magus\CLAUDE.md`); it is currently at
10.0.0.31 (DHCP; normally .48). New deploy is a **git clone** (repo is
public post-scrub) at `~pilot/project-tracker`: systemd
`project-tracker.service` runs `server/dist` on 127.0.0.1:3002 (`HOST`
pinned — bare `localhost` bound only `[::1]` while nginx proxied to IPv4),
nginx serves `/tracker/` static + `/tracker/api/` proxy via
`snippets/project-tracker.conf` included from the atlas site (include is not
in the sentinel template). Scan config maps 8 F-drive roots through the
`/mnt/f-drive` CIFS mount: **117 projects, 0 skipped**, ~3 min cold scan.
Verified from the LAN: page 200, health v2.0.0, actions
`{"enabled":false}`. Never set `ENABLE_LOCAL_ACTIONS` on magus — the proxy
makes LAN requests look loopback to the gate.

Housekeeping: local `directories.json` had two dead roots
(`consciousness-projects`, `environmental_projects` no longer exist on
`F:\`) — dropped from both configs. Stale `.git/index.lock` (2026-05-23)
removed. Remaining known gap: no `claude` route test suite.

---

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
