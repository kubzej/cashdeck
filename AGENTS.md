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
- Styling split: shared components in `src/components/ui` are Tailwind. A
  screen's own layout lives in its feature's CSS file (`features/<name>/*.css`).
  In TSX use a Tailwind utility only for a one-off (e.g. a skeleton height),
  never an arbitrary `[...]` value. Both sides take colors and spacing from
  the Tailwind tokens.
- Respect 44px touch targets, safe areas, the light-only visual system, and
  loading/error/empty/disabled states. Do not add a theme switch or dark-mode
  work unless the product decision changes.
- Before creating a new UI primitive or styling a one-off replacement, inspect
  `src/components/ui/_registry.index.json` and the live Kubkit registry. If a
  matching component exists, install and use it through Kubkit's command flow.
  Install only the components required by the current screen; do not copy the
  whole registry into the app.

## Data and security

- Neon PostgreSQL is the online source of truth. Local storage is cache/session
  mechanics only; never present stale financial data as current offline.
- Access is a single shared passphrase: `POST /api/unlock` checks
  `APP_ACCESS_PASSPHRASE` and issues an HS256 session token (30 days, renewed
  by `GET /api/session` on every launch) for the one fixed `APP_USER_ID`. There
  is no sign-up or multi-user identity flow.
- The Cashdeck API on Railway is the only application data gateway; the
  browser must never call Neon Data API or PostgreSQL directly.
- The API verifies the session token on every protected route and scopes every
  parameterized database query to the token's user id. Never expose database
  connection strings, service roles, or secrets to the client.
- The API uses the restricted `cashdeck_app` PostgreSQL role. Schema changes
  are versioned SQL files applied manually in Neon Console by a schema owner;
  do not add browser-to-database access, RLS/Data API dependencies, migration
  runners, or database-mutating CI jobs.
- Financial writes must be server-confirmed. Do not add optimistic financial
  rows without an explicit product decision.

## Performance and tests

- Never fetch the complete financial history for a screen.
- Use explicit columns, scoped queries, bounded RPCs, keyset pagination, and
  measured indexes.
- Every new behavior needs the smallest appropriate test: Vitest for backend
  and frontend deterministic unit logic, and Playwright for user workflows.
  No component-test framework or database-test framework is included.
  Repository tests therefore mock the `pg` pool: they pin the queries sent and
  the handling of returned rows, not SQL results, so review SQL changes by hand.
- Keep CI green: lint, typecheck, tests, and build must pass before merging.

## Shared constants

- Every list of allowed values and every limit that the server and the frontend must agree on
  (colors, wallet types, periods, max note length, ...) is declared once, in `server/src/catalog.ts`.
  The frontend imports it directly, feature `api.ts` files re-export what their screens need.
- Do not copy such a list, derive its type by hand or repeat its number (`maxLength`, `> 120`)
  elsewhere. `server/src/catalog.test.ts` fails when that happens.
- Lists are plural camelCase in display order with a derived type; limits are `MAX_*`. Values only
  one side needs stay next to the code that uses them.

