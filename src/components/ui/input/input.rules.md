# Input — usage rules

Read `system.rules.md` first.

## Use when

- Collecting a single line of text/number: email, password, search, amounts, names.
- Always pair with a `Label` (via `htmlFor` / `id`). No unlabelled inputs.
- For multi-line text use `Textarea`; for choices use `Select`.
- Use `clearable` for search or filter fields where clearing the current value is a primary action.

## Avoid when

- You need a toggle/boolean → `Switch` or `Checkbox`.
- You need rich validation UI (message, description) tied to the field → use a `Field` wrapper
  (once available) rather than wiring it by hand.

## Hard constraints

- Height, border, colors come from tokens — never restyle via `className`.
- Error state = `aria-invalid` **and** a visible message; never color alone.
- Don't use a bare `<input>`; use `Input` so focus ring + invalid styling stay consistent.
- Prefer `clearable` over browser-native search clear buttons so the clear affordance stays consistent across browsers.
- Controlled clearable inputs must clear their state in `onClear`.

## Responsive & touch

- Input is ≥44px tall by design — don't shrink it. Prefer full-width inputs on mobile.

## Example

```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" placeholder="you@example.com" />

<Input aria-invalid placeholder="Something's off" />

<Input
  type="search"
  value={query}
  onChange={(event) => setQuery(event.currentTarget.value)}
  onClear={() => setQuery("")}
  clearable
  clearLabel="Clear search"
  placeholder="Search"
/>
```
