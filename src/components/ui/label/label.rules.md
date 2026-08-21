# Label — usage rules

Read `system.rules.md` first.

## Use when

- Naming a form control: input, textarea, select, checkbox, switch.
- Always set `htmlFor` to the control's `id` so clicking the label focuses/toggles it.

## Avoid when

- It's not labelling a control → use `Text` or `Eyebrow` instead.

## Hard constraints

- Every interactive form control gets a Label — no unlabelled controls.
- `htmlFor` is required in practice; a Label with no association is a bug.
- Don't restyle the size/weight via `className`; it's a fixed token style.

## Responsive & touch

- Labels should stay paired closely with their controls on mobile and desktop; do not let helper copy
  or ad hoc spacing visually detach them from the input they name.
- When the labelled control is a touch target, keep the full control row comfortable to tap rather
  than shrinking the label or hit area to save space.

## Example

```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />
```
