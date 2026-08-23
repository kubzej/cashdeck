# Switch rules

Read `system.rules.md` first.

## Use when

- A single setting has an instant on/off effect (no separate save step).
- The two states read naturally as "on" and "off", not as two named choices.

## Avoid when

- The change needs a submit/save action to take effect — use a form field instead.
- There are more than two options, or the options are named choices rather than on/off —
  use `ToggleGroup` or `Select`.
- The control needs a visible label baked in — Switch renders only the track and thumb.

## Hard constraints

- Always pair Switch with an adjacent visible label; Switch has no built-in label.
- Do not restyle color, track size, or thumb size via `className`.
- Use `checked`/`onCheckedChange` for a controlled switch; `defaultChecked` for uncontrolled.

## Responsive & touch

- The track is smaller than the 44px minimum; place Switch inside a tappable row (e.g. a
  list item or label) so the effective hit area meets the touch target, not the track alone.

## Example

```tsx
<div className="flex items-center justify-between">
  <span>Zahrnout nepravidelné výdaje</span>
  <Switch checked={value} onCheckedChange={setValue} />
</div>
```
