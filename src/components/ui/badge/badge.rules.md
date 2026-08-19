# Badge — usage rules

Read `system.rules.md` first.

## Use when

- Showing compact metadata, status, category, or short state labels inside dense product UI.
- You need a compact small pill treatment for tables, cards, feeds, and status rows.

## Avoid when

- The element performs an action -> use `Button`, `DropdownMenu`, or a row action.
- The label is long prose. Badges are for short, scannable fragments.
- The state needs explanation or remediation -> use `Alert` or richer inline copy.

## Hard constraints

- Use `size="xs"` for very dense status pills instead of arbitrary height/text overrides.
- Use tone variants (`positive`, `negative`, `warning`, `info`) for short product states.
- Use `muted` as the low-emphasis borderless pill. It must stay visually distinct from
  `secondary` through weaker fill and muted text.
- Use `outline` only when a real outlined badge is intended; keep it subtle and neutral.
- Icons are allowed, but keep them decorative and short; do not turn Badge into a mini button.
- Badge has no `icon` prop. If an icon is needed, compose it as the first child and mark it
  decorative with `aria-hidden` unless it carries unique meaning.
- Do not add custom visible borders. `outline` is the only bordered variant.
- Do not restyle color, size, or radius via `className`; add/extend a closed variant.

## Responsive & touch

- Static badges are not touch targets. If `render` makes a badge navigational, the surrounding row
  or link hit area must reach 44px on touch devices.
- Badges should wrap as a group on mobile; do not squeeze important labels into unreadable pills.

## Example

```tsx
<Badge variant="muted" size="xs">Queued</Badge>
<Badge variant="positive">Active</Badge>
<Badge variant="warning"><Clock3 aria-hidden />Due soon</Badge>
```
