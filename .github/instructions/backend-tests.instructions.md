---
applyTo: "server/src/__tests__/**"
description: "Use when writing or modifying backend tests. Covers test isolation, helper factories, and patterns."
---
# Backend Test Conventions

- Use factory helpers from `__tests__/test-helpers.ts` — never instantiate services with production file paths
  - `createTestUserData()` → temp-file-backed `UserData`
  - `createTestCacheManager()` → temp-file-backed `CacheManager`
  - `createTestApp(options?)` → full Express app with isolated dependencies
- `createTestApp()` accepts optional `userData`, `cacheManager`, and `scanDirectories` overrides
- Route tests use `supertest` against the app returned by `createTestApp()`
- Service unit tests instantiate the service directly with temp paths or mocks
- Each test file should be self-contained — no shared mutable state between test files
- Follow existing patterns: see `routes/health.test.ts` for a minimal route test, `services/user-data.test.ts` for service tests
