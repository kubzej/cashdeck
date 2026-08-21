# Toggle group rules

Read `system.rules.md` first.

## Use when

- A toolbar button needs a pressed state, such as formatting, alignment, or view options.
- A compact segmented control changes a mode, density, layout, or editor state.
- A form or workflow needs a short single-choice control that should stay visually inline.
- A toolbar needs multiple independent pressed states inside one group.

## Avoid when

- The control switches between content panels. Use `Tabs`.
- The control filters a collection or table. Use `Pill`.
- The control is a persisted on/off setting. Use `Switch`.
- The choice must submit as a native form radio group. Use `Radio group` once available.

## Hard constraints

- Use `Toggle` for a standalone pressed button.
- Use `ToggleGroup type="single"` when exactly one mode should be active.
- Use `ToggleGroup type="multiple"` when items can be independently pressed.
- Keep labels short; segmented controls should not wrap.
- Icon-only toggles must include `aria-label`.
- Prefer `width="full"` for two or three short choices in forms or mobile layouts.
- Use the default variant for most segmented controls; reserve `variant="solid"` for a selected state
  that truly needs primary emphasis.
- Do not style ToggleGroup like page navigation; it is a local control.

## Responsive & touch

- Every toggle item must keep a 44px touch target.
- Use short labels on mobile instead of shrinking text below the token scale.
- Avoid horizontally scrolling ToggleGroup. If choices do not fit, use Select or a different layout.
- Vertical groups are only for compact local settings, not side navigation.

## Example

```tsx
<ToggleGroup type="single" defaultValue="comfortable" width="full">
  <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
  <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
  <ToggleGroupItem value="spacious">Spacious</ToggleGroupItem>
</ToggleGroup>
```
