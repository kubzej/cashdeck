# Cashdeck

Private Czech personal-finance PWA for iPhone. Cashdeck is being built as a
simpler, performance-focused replacement for Spendee.

## Project status

Phase 1 foundation and Phase 2 authentication/app shell are complete and
approved. The repository currently contains:

- React + TypeScript + Vite;
- Kubkit-owned theme tokens plus the base Button, form, page-shell, state,
  list, selection, dialog, and navigation components;
- Lucide icons;
- light/dark theme shell;
- portrait PWA manifest and service-worker build configuration;
- Playwright foundation smoke test and a Vitest runner for future pure logic;
- local project rules and CI foundation;
- Neon Auth email/password login with persistent sessions;
- protected mobile shell with the four Cashdeck destinations;
- Phase 3 SQL migrations, Docker PostgreSQL 18, pgTAP fixtures, and RLS tests.

Financial screens and production deployment remain deferred. No Netlify deploy
has been created; `netlify.toml` only describes the future production build.

## Commands

```bash
cd /Users/jakub/Documents/Projects/cashdeck
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm db:test
```

Copy `.env.example` to `.env.local` for local Neon Auth login. The browser test
uses a mocked Auth API and does not depend on production data. It starts its own
temporary Vite server on port `4173`.

Playwright is not part of the normal development server. Run `pnpm test:e2e`
only when adding or changing browser tests, or when you want to verify a full
user flow locally.

The database test command builds a temporary PostgreSQL 18 + pgTAP container,
applies every migration, loads fixtures, runs the database tests, and removes
the container again:

```bash
pnpm db:test
```

For a manually running local test database use `pnpm db:up`, then
`pnpm db:migrate:test` and `pnpm db:fixture:test`. Stop it with `pnpm db:down`.
These commands target only the local Docker database. A deliberate migration
against another database must set `CASHDECK_DATABASE_URL` explicitly before
running `pnpm db:migrate`; Neon production is never used by CI.

Stop the local frontend with `Ctrl-C`; the Playwright command manages and stops
its own temporary server automatically.

## Design rules

Read `AGENTS.md` and the Kubkit rules in `src/components/ui/` before changing
the UI. The detailed product and phase plans live in the Alethea knowledge
repository under the Cashdeck plan.
