# EmptyState rules

Read `system.rules.md` first.

## Use when

- A list, table, feed, panel, or first-run workspace has no items yet.
- Search or filters return no matches and the user needs a quick way back.
- A setup area needs one calm next step before content exists.

## Avoid when

- Content exists and you only want a prettier card.
- The message is a transient success, warning, or error. Use Alert for that.
- The empty area needs form fields, menus, or complex interaction. Use a real page section.

## Hard constraints

- Keep the title short and literal: what is empty, not why the product is great.
- Keep description copy practical and generic in reusable examples.
- Use `EmptyStateIcon` only as a visual anchor. The icon is decorative and should usually be
  `aria-hidden`.
- Put actions inside `EmptyStateActions` and compose kubkit `Button` components. Do not pass action
  objects or hand-roll button styling.
- Use `align="start"` for settings/table contexts; use centered layout for full-page or first-run
  empty states.
- Do not add visible custom borders. EmptyState is a soft surface by default.

## Responsive & touch

- `EmptyStateActions` stacks actions on mobile and lets kubkit Button keep the 44px touch target.
- Avoid long action labels. If a label wraps awkwardly on mobile, shorten it instead of reducing
  button size.
- Do not rely on tooltip-only guidance inside an empty state. The recovery step must be visible.

## Example

```tsx
<EmptyState>
  <EmptyStateIcon>
    <Inbox aria-hidden />
  </EmptyStateIcon>
  <EmptyStateTitle>No messages yet</EmptyStateTitle>
  <EmptyStateDescription>
    New conversations will appear here.
  </EmptyStateDescription>
  <EmptyStateActions>
    <Button>Create message</Button>
  </EmptyStateActions>
</EmptyState>
```
