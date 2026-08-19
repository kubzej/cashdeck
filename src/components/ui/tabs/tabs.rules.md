# Tabs rules

Read `system.rules.md` first.

## Use when

- Related panels occupy the same area and the user needs to switch between them.
- The tab set represents peer sections inside one workflow or page.
- A compact header needs a small number of stable sections.
- Vertical tabs help a settings or details workflow scan better than a long horizontal row.

## Avoid when

- The choices are unrelated destinations. Use navigation.
- The control is really a filter or mode toggle. Use segmented controls or buttons.
- Critical actions or errors would be hidden in inactive panels.
- Labels need multiple lines to make sense.
- The tab list is long enough to become a hidden horizontal scroll trap on mobile.

## Hard constraints

- Every `TabsTrigger` value must have a matching `TabsContent` value.
- Keep labels short and stable; avoid counters that cause layout shifts.
- Use `variant="default"` for primary page sections.
- Use `variant="line"` only for compact secondary panels.
- Do not add visible custom borders around the tab list.

## Responsive & touch

- Triggers must keep a 44px touch target.
- Prefer 2-4 primary tabs. If you need more, consider a Select, navigation route, or overflow pattern.
- For mobile, shorten labels instead of shrinking text below the token scale.
- Use vertical tabs only when there is enough horizontal room for both list and panel.

## Example

```tsx
<Tabs defaultValue="activity">
  <TabsList>
    <TabsTrigger value="activity">Activity</TabsTrigger>
    <TabsTrigger value="files">Files</TabsTrigger>
  </TabsList>
  <TabsContent value="activity">Activity panel</TabsContent>
  <TabsContent value="files">Files panel</TabsContent>
</Tabs>
```
