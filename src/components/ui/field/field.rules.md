# Field — usage rules

Read `system.rules.md` first.

## Use when

- Wrapping **any** labelled form control: Input, Textarea, Select, Checkbox, Switch. Field wires the
  label, description, and error to the control and handles the invalid state — no manual `id`/`htmlFor`.
- You have a helper line (`FieldDescription`) or a validation message (`FieldError`).

## Avoid when

- Just need a caption for a control and nothing else → a bare `Label` is fine.
- A message *about the whole form or page*, not one field → use `Alert`.

## Composition

kubkit Input/Textarea/Select/Checkbox/Switch auto-wire inside a Field — no `htmlFor`/`id` needed:

```tsx
<Field invalid={hasError}>
  <FieldLabel>Email</FieldLabel>
  <Input type="email" />
  <FieldDescription>We'll never share it.</FieldDescription>
  <FieldError match>Enter a valid email.</FieldError>
</Field>
```

For a control that isn't Base UI-based, wrap it: `<FieldControl render={<MyControl />} />`.

## Hard constraints

- Never hand-wire `id` / `htmlFor` / `aria-describedby` — Field owns that.
- Set `invalid` on the Field (not `aria-invalid` on the input) so the label, control, and error all react.
- `FieldError` needs `match` to show — `match` (true) for a custom message, or a validity key.
- Text sizes/colors come from tokens.

## Responsive & touch

- Fields stack full-width by design; keep labels short. Controls keep their ≥44px height, so a column
  of fields stays comfortable on mobile.

## Example

```tsx
<Field invalid={hasError}>
  <FieldLabel>Email</FieldLabel>
  <Input type="email" />
  <FieldDescription>We'll never share it.</FieldDescription>
  <FieldError match>Enter a valid email.</FieldError>
</Field>
```
