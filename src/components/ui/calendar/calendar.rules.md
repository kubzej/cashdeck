# Calendar / DatePicker Rules

Read `system.rules.md` first.

## Use when

- A form or filter needs one exact date.
- Users benefit from seeing nearby days before choosing.
- The date should submit as a normal field value (`name` creates a hidden `yyyy-mm-dd` input).
- You need a compact popover picker beside other form controls.

## Avoid when

- The UI is a schedule, timeline, booking grid, or recurring event editor; use a domain calendar library.
- The task is mostly relative ranges such as "last 7 days"; use `Pill` presets and compose two `DatePicker`s only for custom ranges.
- Native mobile date input is clearly better for the platform and product.
- The date is read-only metadata; use plain text, `Badge`, or `TableCell`.

## Hard constraints

- Pair `DatePicker` with a visible `FieldLabel` or equivalent label.
- Keep app data boundaries explicit: `DatePicker` emits `Date`; APIs usually want `yyyy-mm-dd` or ISO strings.
- Use `minDate`, `maxDate`, or `disabledDates` for impossible choices instead of validating after the user clicks.
- Do not use placeholders as labels.
- Keep disabled dates visibly quiet and non-interactive.

## Responsive & touch

- Day cells are fixed at 44px; do not shrink them to fit more months.
- On mobile, keep one month visible and let the picker be full-width in the form.
- For custom ranges, stack "From" and "To" fields on small screens.
- Avoid dense helper copy inside the popup; put guidance in `FieldDescription`.

## Example

```tsx
import { DatePicker } from "@/components/ui/calendar";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";

<Field>
  <FieldLabel>Publish date</FieldLabel>
  <DatePicker
    name="publishDate"
    placeholder="Choose a date"
    minDate={new Date()}
    onValueChange={setPublishDate}
  />
  <FieldDescription>Choose when this page should go live.</FieldDescription>
</Field>
```
