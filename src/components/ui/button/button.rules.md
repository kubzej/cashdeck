# Button — usage rules

Read this before writing `<Button>` props. Read `system.rules.md` first for kit-wide rules.

## Use when

- Triggering an action: submit, confirm, open a dialog, run a command.
- The primary action on a view → `variant="default"`. Secondary → `secondary` or `outline`.
- Destructive action (delete, remove) → `variant="destructive"`, ideally behind a confirm.
- Navigation styled as a button → use `render={<a href="…" />}`, not an onClick that pushes.

## Avoid when

- It's really a link in body text → use a text link, not a Button.
- You need a toggle/switch state → use Switch/Toggle, not a Button.
- Icon-only without a label → allowed only with `size="icon"` **and** an `aria-label`.

## Hard constraints

- Values come from `variant` / `size` only. Do not hand-roll colors or sizes via `className`.
- Never nest interactive elements — compose with `render`, don't wrap.
- Keep one primary (`default`) button per view; everything else is secondary/ghost.

## Async

- Use `loading` for any action that awaits a promise — it shows a spinner, blocks clicks and
  sets `aria-busy`. Don't roll your own disabled+spinner; don't leave `loading` unresolved.

## Responsive & touch

- Every size is ≥44px tall by design — do not override height smaller. Icon = 44×44.
- On narrow/mobile viewports, prefer `className="w-full"` (full-width) over a cramped button; don't reduce the touch target.
- Button rows must wrap or stack on mobile — never rely on horizontal room that a phone doesn't have.

## Example

```tsx
<Button variant="secondary" size="sm">Save</Button>
<Button variant="destructive" onClick={onDelete}>Delete</Button>
<Button render={<a href="/settings" />}>Settings</Button>
<Button size="icon" aria-label="Close"><X /></Button>
```
