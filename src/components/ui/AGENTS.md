# Kubkit UI Components

These components were copied into this app from the kubkit registry.

## Folder shape

Every installed component should live in its own folder:

- `components/ui/<name>/index.tsx` — runtime component code
- `components/ui/<name>/<name>.spec.json` — machine-readable API contract
- `components/ui/<name>/<name>.rules.md` — usage rules for humans and agents
- `components/ui/system.rules.md` — kit-wide rules shared by every kubkit component

The file `components/ui/_registry.index.json` is the kubkit component map plus the local folder
convention. It may list components that exist in the kubkit registry even if this app has only
installed a subset, so agents must verify the referenced files exist locally before relying on them.

## Required workflow for agents

1. Before using or editing a kubkit component, read `components/ui/_registry.index.json`.
2. Verify the target component's `index.tsx`, `*.spec.json`, and `*.rules.md` files exist locally.
3. Read `components/ui/system.rules.md`.
4. Then read the target component's adjacent `*.spec.json` and `*.rules.md`.
5. Prefer documented props, variants, and composition patterns over ad hoc `className` overrides.
6. If you edit a kubkit component itself, keep `index.tsx`, `*.spec.json`, and `*.rules.md` in sync.
7. If the component behavior depends on shared tokens or helpers, inspect the imported shared files
   before changing styling or structure.

## Practical rules

- Import installed components from `@/components/ui/<name>`.
- Do not move `spec` or `rules` away from the component folder.
- Do not delete `system.rules.md`; component rules assume it exists.
- Do not delete `_registry.index.json`; it is the discovery layer for agents.
- If multiple kubkit components are involved in one screen, read the metadata for every touched
  component, not just the first one you notice.
