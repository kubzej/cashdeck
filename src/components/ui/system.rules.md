# kubkit — system rules

Kit-wide design rules. An AI (or a human) building UI with kubkit reads this first, then the
per-component `*.rules.md` for each component in use. These rules are enforced — treat them as
constraints, not suggestions.

## 1. Responsive & touch (non-negotiable — targets are PWAs)

- **Design every screen for mobile AND desktop.** Mobile-first: base styles target the small
  screen, `sm:`/`md:`/`lg:`/`xl:` scale up. Never ship a layout that only works on desktop.
- **Minimum touch target 44×44px** for anything interactive. Do not shrink controls below it.
- Use the breakpoint tokens (`sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`). Don't invent
  arbitrary media queries.
- Respect PWA safe areas — use `env(safe-area-inset-*)` for full-bleed / fixed UI (notches).
- Layouts flow/stack/wrap on mobile; never depend on horizontal space a phone lacks.

## 2. Closed token layer (no arbitrary values)

- Use only the semantic tokens: colors (`bg-primary`, `text-muted-foreground`, sentiment
  `text-positive/negative/warning/info`), radii (`rounded-{sm,md,lg,xl}`), the spacing scale.
- **Never** use arbitrary Tailwind values (`bg-[#…]`, `p-[13px]`, `rounded-[7px]`) or inline
  hex/rgb. If a value is missing, add a token — don't hardcode.
- Numbers/prices/data use `.font-mono-num` (tabular, monospaced).

## 3. Theming

- Cashdeck is light-only by product decision. Use semantic tokens so the
  interface remains internally consistent, but do not add dark-mode behavior,
  theme switching, or system-theme detection.

## 4. Composition & density

- Prefer composing existing components over new one-offs. Check the catalog first.
- One primary action per view. Keep density consistent; don't mix cramped and airy in one screen.
- Compose polymorphically with the `render` prop (Base UI idiom) — don't wrap interactive
  elements in other interactive elements.

## 5. Accessibility

- Icon-only controls need an `aria-label`. Preserve focus-visible rings (don't remove outlines).
- Use semantic elements; let Base UI handle keyboard/ARIA — don't reimplement it.

## 6. Focus, invalid, and interaction states

- Use the shared `focus-ring` and `invalid-ring` utilities. Do not hand-roll alternate focus styles.
- Hover, focus, selected, invalid, loading, and disabled states should come from tokens and component
  APIs, not one-off CSS overrides.
- Do not remove focus-visible treatment to make a demo look cleaner. Accessibility beats screenshots.

## 7. Icons

- Use Lucide icons when an established symbol exists. Keep icon sizing consistent with the surrounding
  control rather than scaling icons ad hoc.
- Decorative icons should be `aria-hidden`. Icon-only interactive controls need an accessible label.
- Do not mix multiple icon styles in one surface unless the product meaning truly requires it.

## 8. Surfaces, borders, and radius

- Borderless by default. Prefer fill, tone, spacing, and shadow before adding a visible border.
- Use the shared radius scale; do not introduce custom corner radii per component or page.
- Keep repeated items visually even. If a row family or chip family belongs together, their height,
  padding, and radius should read as one system.

## 9. Spacing rhythm

- Use the shared spacing scale to create steady vertical rhythm between sections, cards, fields, and
  repeated rows. Do not pack one area tightly while leaving the next one airy without a reason.
- Repeated UI should align to a stable internal padding model. Avoid ad hoc one-off spacing fixes in
  the catalog when the primitive itself should own that rhythm.
