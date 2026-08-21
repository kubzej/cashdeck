# FeedbackState — usage rules

Read `system.rules.md` first.

## Use when

- A region reflects the **result or progress of an operation**: loading, error, success, or
  info/pending. It stands in for the content while that state lasts.
- You need a compact **inline** status row ("Saving…", "Couldn't sync · Retry") — use `layout="inline"`.
- A whole view failed or is loading — use `layout="page"`.

## Avoid when

- **Alert** — an inline message *beside* content that stays in the flow ("Heads up, your trial ends
  soon"). FeedbackState *replaces* the region; Alert sits within it.
- **Empty state** — a calm, neutral "nothing here yet" with first-run guidance. FeedbackState is the
  operational, status-tinted family (loading/error/success/pending). Reach for Empty state when the
  region is simply empty, not when something happened.

## Composition

```tsx
<FeedbackState status="error" layout="panel">
  <FeedbackStateIcon><CircleAlert /></FeedbackStateIcon>
  <FeedbackStateContent>
    <FeedbackStateTitle>Couldn't load the page</FeedbackStateTitle>
    <FeedbackStateDescription>Check your connection and try again.</FeedbackStateDescription>
  </FeedbackStateContent>
  <FeedbackStateActions>
    <Button>Retry</Button>
  </FeedbackStateActions>
</FeedbackState>
```

For `loading`/pending, put a spinning icon in the slot: `<Loader2 className="animate-spin" />`.

## Hard constraints

- `status` drives the icon tint (error → destructive, success → positive, info → info) — pick it by
  meaning. Never signal a state with colour alone; keep the icon + text clear.
- Borderless: the soft fill is the container. Don't add a prominent border.
- Every state needs a title; a description and actions are optional but recommended for error/empty.

## Responsive & touch

- `inline` wraps its action below the text on narrow screens; keep titles short.
- `page`/`panel` stay centred and readable on mobile — descriptions cap at a comfortable width.
- Action buttons go full-width on mobile (handled by `FeedbackStateActions`).

## Example

```tsx
<FeedbackState status="error" layout="panel">
  <FeedbackStateIcon><CircleAlert /></FeedbackStateIcon>
  <FeedbackStateContent>
    <FeedbackStateTitle>Couldn't load the page</FeedbackStateTitle>
    <FeedbackStateDescription>Check your connection and try again.</FeedbackStateDescription>
  </FeedbackStateContent>
  <FeedbackStateActions>
    <Button>Retry</Button>
  </FeedbackStateActions>
</FeedbackState>
```
