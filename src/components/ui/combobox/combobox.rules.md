# Combobox — usage rules

Read `system.rules.md` first.

## Use when

- Choosing one item from a **large or unbounded** list where typing to filter beats scrolling:
  a country, a user, a repo, a ticker, a tag.
- Autocomplete over a set the user roughly knows the name of.

## Avoid when

- A short, fixed list (≤ ~7) → **Select**. No typing needed; simpler.
- A yes/no → **Switch**. A few visible options → radios.
- Free-form text with no options → an **Input**.

## Composition

```tsx
<Combobox items={frameworks}>
  <ComboboxInput placeholder="Search framework…" />
  <ComboboxContent>
    <ComboboxEmpty>No framework found.</ComboboxEmpty>
    <ComboboxList>
      {(item) => (
        <ComboboxItem key={item} value={item}>{item}</ComboboxItem>
      )}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```

Base UI filters `items` by the input text; `ComboboxList`'s function renders the matches.

## Hard constraints

- Always include `ComboboxEmpty` — a search with no matches must say so, not show a blank popup.
- Give the input a placeholder and an accessible name (a `Label`, or wrap in a `Field`).
- Colors/height come from tokens; don't restyle the input, popup, or items via `className`.

## Responsive & touch

- The input is ≥44px tall (touch). The popup scrolls within the available height on small screens.
  Prefer full-width comboboxes on mobile so the filtered list is easy to read and tap.

## Example

```tsx
<Combobox items={frameworks}>
  <ComboboxInput placeholder="Search framework…" />
  <ComboboxContent>
    <ComboboxEmpty>No framework found.</ComboboxEmpty>
    <ComboboxList>
      {(item) => (
        <ComboboxItem key={item} value={item}>{item}</ComboboxItem>
      )}
    </ComboboxList>
  </ComboboxContent>
</Combobox>
```
