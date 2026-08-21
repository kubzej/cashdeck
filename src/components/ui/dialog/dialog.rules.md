# Dialog rules

Read `system.rules.md` first.

## Use when

- A focused workflow needs to interrupt the current page: edit details, choose a destination, review
  generated content, or complete a short form.
- The user must confirm a risky or irreversible action. Use the `AlertDialog*` parts from this same
  module for that.
- The content needs focus trapping, escape key handling, backdrop dismissal, and accessible title /
  description wiring from Base UI.

## Avoid when

- The message is passive feedback. Use Alert.
- The content is a persistent page region. Keep it on the page.
- The interaction is an edge panel or mobile drawer. Use Sheet once available.
- The confirmation can be handled safely by an undo toast or inline action.

## Dialog vs AlertDialog

- `Dialog*` is for normal modal workflows. It may close via outside press, escape, close icon, or
  footer cancel.
- `AlertDialog*` is for decisions that require an explicit response. It is the confirmation pattern;
  do not create a separate generic ConfirmDialog unless an app needs business-specific defaults.
- Both parts live in `dialog.tsx` so the visual language and rules stay together.

## Hard constraints

- Every dialog must have `DialogTitle` / `AlertDialogTitle`.
- Use `DialogDescription` / `AlertDialogDescription` when the title alone does not explain the
  outcome.
- Compose footer actions with kubkit `Button` using `render={<DialogClose />}` or
  `render={<AlertDialogClose />}` for close/response controls.
- Use one primary action and one secondary/cancel action. More actions usually means the workflow
  should be redesigned.
- Do not add visible custom borders to the popup. The surface is separated by backdrop, fill, and
  shadow.
- Keep copy short. Dialogs are for decisions and workflows, not documentation.

## Responsive & touch

- Footer actions stack on mobile and keep kubkit Button's 44px touch target.
- Dialog content scrolls inside the viewport when taller than the screen. Do not force body scroll
  with arbitrary max-height classes.
- Keep form fields and action buttons reachable without horizontal scrolling.
- Avoid icon-only footer actions. Labels must be visible.

## Examples

```tsx
<Dialog>
  <DialogTrigger render={<Button />}>Edit details</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit details</DialogTitle>
      <DialogDescription>Update the information shown to teammates.</DialogDescription>
    </DialogHeader>
    <DialogBody>{/* form fields */}</DialogBody>
    <DialogFooter>
      <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
      <Button>Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

```tsx
<AlertDialog>
  <AlertDialogTrigger render={<Button variant="destructive" />}>
    Delete file
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete file?</AlertDialogTitle>
      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogClose render={<Button variant="secondary" />}>Cancel</AlertDialogClose>
      <AlertDialogClose render={<Button variant="destructive" />}>Delete</AlertDialogClose>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```
