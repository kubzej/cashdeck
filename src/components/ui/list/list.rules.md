# List Rules

Read `system.rules.md` first.

## Use when

- Rendering repeated rows that are not comparable enough for a table.
- Showing queues, settings rows, files, notifications, recent activity, or compact summaries.
- Rows need optional leading icons, secondary text, metadata, and trailing actions.
- The whole row may be clickable, but the layout is still a row, not a card.

## Avoid when

- Users need to compare values across columns; use Table.
- The item is a standalone content object with header/body/footer; use Card.
- The row opens a small floating action menu; compose DropdownMenu in `ListItemActions`.
- The content is empty or failed to load; use EmptyState or FeedbackState around the list.

## Hard constraints

- Keep hover opt-in with `interactive`; static lists should not imply clickability.
- Use `selected` for the current row instead of restyling via ad hoc classes.
- Keep leading visuals compact. Do not turn `ListItemLeading` into a card.
- Keep row copy short enough to scan.
- Preserve role semantics. The default root is `role="list"` and item is `role="listitem"`; custom render targets can override roles.

## Responsive & touch

- `size="compact"` still keeps a 44px minimum target.
- On mobile, keep trailing actions short or move overflow actions into a menu.
- Let metadata wrap instead of forcing horizontal overflow.
- Use `List gap="sm"` for dense work surfaces and `gap="lg"` only when rows need more breathing room.

## Example

```tsx
import {
  List,
  ListItem,
  ListItemContent,
  ListItemTitle,
  ListItemDescription,
  ListItemActions,
} from "@/components/ui/list";

<List>
  <ListItem interactive>
    <ListItemContent>
      <ListItemTitle>Review copy</ListItemTitle>
      <ListItemDescription>Assigned to workspace team.</ListItemDescription>
    </ListItemContent>
    <ListItemActions>Ready</ListItemActions>
  </ListItem>
</List>
```
