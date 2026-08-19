# Skeleton — usage rules

Read `system.rules.md` first.

## Use when

- A content region is loading and its approximate layout is already known.
- Preserving page structure would feel calmer than swapping in a spinner.
- Loading rows, cards, media blocks, or short text groups that will be replaced in place.

## Avoid when

- The wait is too short to need a visible loading state.
- The user needs progress, error recovery, or a message with actions.
- The final layout is unknown; use a simpler loading message instead of fake structure.

## Hard constraints

- Skeleton is decorative by default (`aria-hidden`). Put `aria-busy` and/or visible or `sr-only`
  loading copy on the parent region.
- Use closed shapes only: `line`, `block`, `circle`, `pill`.
- Use `className` for layout dimensions only: width, height, flex/grid placement. Do not restyle
  color, radius, or animation.
- The skeleton shape should resemble the content it replaces. Do not create random ornamental bars.
- Disable animation with `animated={false}` for static previews or when motion would distract.

## Responsive & touch

- Match the responsive layout of the final content. If the content stacks on mobile, the skeleton
  should stack too.
- Skeleton is not interactive and must never block touch targets after loading completes.

## Example

```tsx
<div aria-busy="true" className="space-y-3">
  <span className="sr-only">Loading profile</span>
  <Skeleton shape="circle" />
  <Skeleton className="w-40" />
  <Skeleton className="w-64 max-w-full" />
</div>
```
