# Cashdeck

Private Czech personal-finance PWA for iPhone. Cashdeck is being built as a
simpler, performance-focused replacement for Spendee.

## Foundation status

Phase 1 foundation is complete and approved. The repository currently contains
the project foundation:

- React + TypeScript + Vite;
- Kubkit-owned theme tokens plus the base Button, form, page-shell, state,
  list, selection, dialog, and navigation components;
- Lucide icons;
- light/dark theme shell;
- portrait PWA manifest and service-worker build configuration;
- Playwright foundation smoke test and a Vitest runner for future pure logic;
- local project rules and CI foundation.

Neon Auth, Neon tables, financial data, and real navigation are intentionally
deferred to later phases. No Netlify deploy has been created; `netlify.toml`
only describes the future production build.

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
```

The app shell does not require Neon credentials yet. Copy `.env.example`
to `.env.local` when the authentication phase is implemented. The browser test
starts its own temporary Vite server on port `4173`.

Playwright is not part of the normal development server. Run `pnpm test:e2e`
only when adding or changing browser tests, or when you want to verify a full
user flow locally.

Docker is not needed to run the current frontend shell. Database migrations
and PostgreSQL tests belong to the database phase; they will use the selected
Neon development branch or an isolated PostgreSQL test database, not a local
hosted backend stack. Stop the local frontend with `Ctrl-C`; the Playwright command
manages and stops its own temporary server automatically.

## Design rules

Read `AGENTS.md` and the Kubkit rules in `src/components/ui/` before changing
the UI. The detailed product and phase plans live in the Alethea knowledge
repository under the Cashdeck plan.
