# Page shell rules

Read `system.rules.md` first.

## Use when

- A routed page needs consistent content width, bottom spacing, and vertical rhythm.
- A page needs a standard intro with title, subtitle, meta, leading back control, or actions.
- Tabs, filters, or compact controls should remain visible in a sticky top rail.
- Page content should be split into semantic sections without turning every section into a card.

## Avoid when

- You are building the global app layout, sidebar, mobile header, or router frame.
- A component needs an internal layout wrapper. Page shell is page-level only.
- The page is a focused modal, sheet, popover, or card workflow.
- Top controls are too large or complex to stay sticky.

## Hard constraints

- Use `PageShell` inside the app's existing main area, not as a replacement for it.
- Use `PageIntro` for page-level title/actions instead of inventing one-off headers.
- Use `PageTopRail` only for compact controls such as tabs, filters, and segmented controls. It
  aligns to the PageShell content by default; opt into edge bleed with `className` only when the app
  layout needs it.
- Use `PageSection` for page rhythm; do not wrap every section in `Card`.
- Keep `bleed` rare and deliberate.
- PageBackButton is native and local; wire it to your router/navigation handler.

## Responsive & touch

- Page-level actions must wrap cleanly on mobile.
- Top rail controls must preserve 44px touch targets.
- Sticky rails should stay short; avoid tall filter stacks that consume the mobile viewport.
- Width variants are max-widths. On phone-sized viewports, `narrow`, `default`, and `wide` can all
  fill the same available content track.
- Prefer `width="full"` only when the content manages responsive width itself.

## Example

```tsx
<PageShell width="wide" gap="lg">
  <PageIntro
    title="Projects"
    subtitle="Track work across your team."
    actions={<Button>Create</Button>}
  />
  <PageTopRail>{/* tabs or filters */}</PageTopRail>
  <PageSection>{/* page content */}</PageSection>
</PageShell>
```
