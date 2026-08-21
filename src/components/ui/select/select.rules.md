# Select — usage rules

Read `system.rules.md` first.

## Use when

- Choosing **one** option from a longer list (5+), where showing them all inline would be noise.
- Give the trigger a name: a `Label` (with the trigger's `id`) or `aria-label`.

## Avoid when

- 2–4 options that fit on screen → use radios or a segmented control (fewer clicks).
- A yes/no → use `Switch` or `Checkbox`.
- Free text → use `Input`.

## Composition

Pass `items` (value → label) so the trigger shows the **label**, not the raw value:

```tsx
<Select items={{ newest: "Newest", oldest: "Oldest" }}>
  <SelectTrigger><SelectValue placeholder="Sort by…" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="newest">Newest</SelectItem>
    <SelectItem value="oldest">Oldest</SelectItem>
  </SelectContent>
</Select>
```

Without `items`, the trigger renders the raw value (e.g. `newest`) instead of `Newest`.

## Hard constraints

- Trigger and popup colors/height come from tokens — never restyle via `className`.
- Every `SelectItem` needs a `value`. The trigger needs an accessible name.
- Keep option labels short; don't wrap long sentences into items.

## Responsive & touch

- The trigger is ≥44px tall (touch). The popup scrolls within the available height on small screens —
  don't force a fixed tall list. Prefer full-width triggers on mobile.

## Example

```tsx
<Select items={{ newest: "Newest", oldest: "Oldest" }}>
  <SelectTrigger>
    <SelectValue placeholder="Sort by…" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="newest">Newest</SelectItem>
    <SelectItem value="oldest">Oldest</SelectItem>
  </SelectContent>
</Select>
```
