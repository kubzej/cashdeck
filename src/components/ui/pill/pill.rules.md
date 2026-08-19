# Pill rules

Read `system.rules.md` first.

## Use when

- A list, table, chart, or page section needs lightweight filters.
- A small control changes sort order, density, or view mode without switching major content panels.
- Related chip controls need to wrap or scroll horizontally on mobile.
- A filter needs a compact count or token-based status dot.

## Avoid when

- The text is static metadata or status. Use `Badge`.
- The control switches main content sections. Use `Tabs`.
- The control is a binary on/off setting. Use `Switch`.
- The control is a form-only segmented choice. Use `ToggleGroup` once available.

## Hard constraints

- Keep labels short and scannable.
- Use `active` for selected state; do not restyle selected state through `className`.
- Use `tone` first when the whole pill needs one of kubkit's semantic colors.
- Use `activeClassName` / `inactiveClassName` only for app-specific category colors that cannot be
  represented by `tone`. Define those classes once in the feature, then spread them into each Pill.
- Use `count`, `direction`, and token `indicator` props instead of custom inline markup for common
  chip metadata.
- Keep tones and indicators token-based when possible: `positive`, `negative`, `warning`, `info`, or
  neutral/muted equivalents.
- Keep custom category colors readable in light and dark mode; provide both inactive and active
  treatments.
- Prefer `PillGroup behavior="wrap"` unless wrapping creates an awkward multi-line toolbar.

## Responsive & touch

- Every Pill size keeps at least a 44px touch target.
- Use `PillGroup behavior="scroll"` when a chip set must stay on one row.
- Use `bleed` only when a mobile scroll row should align to the viewport edge.
- Do not hide essential actions past a long horizontal scroll row.

## Example

```tsx
const categoryColors = {
  design: {
    inactiveClassName:
      "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/45 dark:text-sky-300",
    activeClassName:
      "bg-sky-600 text-white hover:bg-sky-600 dark:bg-sky-500",
  },
  launch: {
    inactiveClassName:
      "bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 dark:bg-fuchsia-950/45 dark:text-fuchsia-300",
    activeClassName:
      "bg-fuchsia-600 text-white hover:bg-fuchsia-600 dark:bg-fuchsia-500",
  },
};

<PillGroup>
  <Pill active count={12}>Open</Pill>
  <Pill tone="positive" count={4}>Ready</Pill>
  <Pill direction="desc">Newest</Pill>
  <Pill active {...categoryColors.design}>Design</Pill>
  <Pill {...categoryColors.launch}>Launch</Pill>
</PillGroup>
```
