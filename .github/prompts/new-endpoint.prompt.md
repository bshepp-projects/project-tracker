---
description: "Scaffold a new API endpoint: route file, app.ts registration, types, and test"
agent: "agent"
argument-hint: "resource name and what it does (e.g., 'notes - CRUD for project notes')"
---
Create a new API endpoint for this project following the established patterns:

1. **Route file** — Create `server/src/routes/{resource}.ts` with a `create{Resource}Router(deps)` factory function that returns an Express Router. Only accept the specific dependencies needed (not the full `AppDependencies`). Follow the pattern in [routes/health.ts](server/src/routes/health.ts) for structure.

2. **Register in app.ts** — Import the new router in [app.ts](server/src/app.ts) and register it with `app.use('/api', create{Resource}Router(...))`, passing only the required dependencies.

3. **Types** — Add any new interfaces or types to [types.ts](server/src/types.ts).

4. **Test** — Create `server/src/__tests__/routes/{resource}.test.ts` using `createTestApp()` from [test-helpers.ts](server/src/__tests__/test-helpers.ts) and `supertest`. Follow the pattern in existing route tests.

5. **Validate** — Run `cd server && npm test` to confirm everything passes.
