# Typography — usage rules

`Heading` · `Text` · `Eyebrow`. The closed text scale. Read `system.rules.md` first.

## Use when

- **Heading** — a section/page title. `level` by meaning (1 = page, 2 = section, 3 = subsection,
  4 = small heading), not by how big you want it. Restyle via the scale, never `className`.
- **Text** — any body/label/value text. `tone="muted"` for secondary text; `numeric` for
  prices/amounts/aligned figures (tabular mono).
- **Eyebrow** — a small uppercase label above a section or group (the "kicker").

## Avoid when

- It's a control's own label tied to an input → use `Label`, not `Text`.
- You need a raw heading level for document semantics but a different look → still use `Heading`
  and pick `level` by meaning; the look is the scale's job.

## Hard constraints

- Size/weight/tone come from props only — never hand-roll type via `className`.
- `Text` defaults to `<span>` (inline). For a paragraph use `render={<p />}`.
- Don't pick a `Heading` level for its size; pick it for structure.

## Responsive & touch

- The scale is mobile-first and already readable on small screens — don't shrink text below the
  provided sizes. If a heading is too big on mobile, drop a `level`, don't override the size.

## Example

```tsx
<Heading level={1}>Components</Heading>
<Eyebrow>Foundations</Eyebrow>
<Text tone="muted">Updated just now</Text>
<Text numeric weight="semibold">1,024</Text>
<Text render={<p />}>A full paragraph of body copy.</Text>
```
