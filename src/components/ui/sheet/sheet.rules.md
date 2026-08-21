# Sheet rules

Read `system.rules.md` first.

## Use when

- Mobile navigation or a selector needs a temporary full-height panel.
- A compact workflow needs more room than Popover but should keep the current page visible behind it.
- A right or left side panel should hold filters, details, or settings without changing routes.
- A bottom sheet should present a short mobile picker or a small action set.

## Avoid when

- The content is plain text only. Use Tooltip.
- The content is a short anchored control. Use Popover.
- The user must confirm a destructive or required decision. Use AlertDialog from the Dialog module.
- The workflow needs a centered, focused modal. Use Dialog.
- The panel needs deep multi-step navigation. Prefer a route or app shell pattern.

## Hard constraints

- Compose triggers with kubkit `Button` through `render={<Button />}` unless the trigger is a custom
  navigation row with a clear 44px hit target.
- Use `SheetHeader`, `SheetBody`, and `SheetFooter` for structured panels.
- Use `SheetClose` for footer cancel/done actions that should close the panel.
- Do not add visible custom borders. The sheet is separated by backdrop, fill, shadow, and placement.
- Keep bottom sheets short; use side sheets for scrollable workflows.

## Responsive & touch

- Header, footer, and list row actions must keep a 44px touch target.
- Use `side="bottom"` primarily for short mobile selectors or action sets.
- Use `side="right"` or `side="left"` for navigation, filters, forms, or content that can scroll.
- Keep the primary action visible in `SheetFooter` when the sheet contains editable content.

## Example

```tsx
<Sheet>
  <SheetTrigger render={<Button />}>Open panel</SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Panel title</SheetTitle>
      <SheetDescription>Short helper text.</SheetDescription>
    </SheetHeader>
    <SheetBody>{/* scrollable content */}</SheetBody>
    <SheetFooter>
      <SheetClose render={<Button variant="secondary" />}>Cancel</SheetClose>
      <Button>Save</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```
