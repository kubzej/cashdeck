# Card rules

Read `system.rules.md` first.

## Use when

- Related information and actions need a reusable grouped surface.
- A repeated item needs clear ownership of title, metadata, body, and actions.
- A compact panel needs header/content/footer structure without becoming a modal or page section.
- A single row-like card should be clickable as one target.
- A soft status tint would help scanning, but the content is still a working surface rather than feedback chrome.

## Avoid when

- You are styling a full page section. Use normal layout, not Card.
- The surface would contain another card. Flatten the hierarchy.
- The only purpose is adding a decorative box around content.
- The content is temporary feedback. Use Alert.
- The content is an empty collection fallback. Use EmptyState.
- The only requirement is open/closed state. Compose Card with local state or Collapsible rather than expecting Card to own expansion.

## Hard constraints

- Use `CardHeader`, `CardContent`, and `CardFooter` for structured cards.
- Put `CardAction` in the header only for compact actions or status.
- Do not add visible custom borders. Use fill, spacing, and shadow.
- Use `tone` only for subtle semantic emphasis; keep the default tone for neutral containers.
- Keep `variant="elevated"` for isolated hero/detail cards, not dense repeated lists.
- Set `interactive` only when the whole card is one click target; otherwise keep actions local.

## Responsive & touch

- Interactive cards must have a clear 44px touch target.
- Header actions must remain reachable without overlapping title text.
- Repeated mobile cards should stay compact and avoid oversized titles.
- Footer actions stack on mobile and align horizontally on larger screens.
- Expandable card patterns should reveal more detail without turning the collapsed state into a miniature page.

## Example

```tsx
<Card>
  <CardHeader>
    <div className="grid gap-1">
      <CardTitle>Team activity</CardTitle>
      <CardDescription>Recent updates from the workspace.</CardDescription>
    </div>
    <CardAction>
      <Button size="sm" variant="secondary">View</Button>
    </CardAction>
  </CardHeader>
  <CardContent>{/* grouped content */}</CardContent>
</Card>
```
