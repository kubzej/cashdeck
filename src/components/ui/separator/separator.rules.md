# Separator rules

Read `system.rules.md` first.

## Use when

- Related content needs a quiet boundary inside the same surface.
- A menu, popover, or settings group needs sections without another heading.
- A compact toolbar needs a short vertical division between control groups.
- A page layout needs rhythm but a card, alert, or heading would be too heavy.

## Avoid when

- The divider is only decoration and adds visual noise.
- You are trying to fake a card border, table grid, or framed page section.
- Spacing, grouping, or a heading would explain the structure better.
- The mobile layout stacks the groups and the divider no longer separates anything.

## Hard constraints

- Use the default decorative separator unless the division carries semantic meaning.
- Use `decorative={false}` only with meaningful section separation.
- Use `className` for layout only: margins, width, height, flex/grid placement.
- Do not restyle thickness or color per instance.
- Vertical separators need a parent height or a flex row where `self-stretch` can work.

## Responsive & touch

- Separator is not interactive and must never reduce a nearby control below a 44px touch target.
- On mobile, remove separators that become redundant after stacked layout changes.
- Prefer spacing over a divider when the layout is already visually clear.

## Example

```tsx
<div className="space-y-4">
  <p>Account details</p>
  <Separator />
  <p>Notification preferences</p>
</div>
```
