# Cashdeck AI Rules

## Product boundary

- Cashdeck is an iPhone portrait PWA. Do not add desktop layouts, native iOS
  projects, Expo workflows, or offline financial-data behavior.
- UI copy is Czech and money is CZK-only, whole crowns only.
- Do not invent financial behavior that is not documented in the planning
  source of truth.

## Kubkit

- Read `src/components/ui/AGENTS.md` and
  `src/components/ui/system.rules.md` before changing UI.
- Use copied Kubkit components and their adjacent rules/specs. Cashdeck owns
  the copied files and may tune them locally when the project needs it.
- Use Lucide for functional icons. Icon-only controls need an accessible
  label.
- Use semantic tokens and the shared spacing/radius system. Do not add
  arbitrary colors, radii, or spacing values to UI classes.
- Respect 44px touch targets, safe areas, light/dark theme behavior, and
  loading/error/empty/disabled states.
- Before creating a new UI primitive or styling a one-off replacement, inspect
  `src/components/ui/_registry.index.json` and the live Kubkit registry. If a
  matching component exists, install and use it through Kubkit's command flow.
  Install only the components required by the current screen; do not copy the
  whole registry into the app.

## Data and security

- Neon PostgreSQL is the online source of truth. Local storage is cache/session
  mechanics only; never present stale financial data as current offline.
- Neon Auth owns email/password sessions. The Cashdeck API on Railway is the
  only application data gateway; the browser must never call Neon Data API or
  PostgreSQL directly.
- The API verifies the Neon Auth JWT and forwards it through the official Neon
  serverless driver to Neon RLS. Never expose database connection strings,
  service roles, or secrets to the client.
- Every user-owned database row is protected by RLS and `auth.user_id()`.
  Keep SQL scopes explicit even when RLS already enforces ownership.
- Financial writes must be server-confirmed. Do not add optimistic financial
  rows without an explicit product decision.

## Performance and tests

- Never fetch the complete financial history for a screen.
- Use explicit columns, scoped queries, bounded RPCs, keyset pagination, and
  measured indexes.
- Every new behavior needs the smallest appropriate test: Vitest for backend
  and frontend deterministic unit logic, and Playwright for user workflows.
  No component-test framework or database-test framework is included.
- Keep CI green: lint, typecheck, tests, and build must pass before merging.
