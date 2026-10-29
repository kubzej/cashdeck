import type { Label } from './api'

const MAX_SUGGESTED_LABELS = 8

/**
 * Keeps every selected label and at most `MAX_SUGGESTED_LABELS` unselected ones, in order.
 * Selected labels must never be dropped: a chip that disappears while its id is still part of the
 * selection can no longer be seen or removed, yet it is saved with the record.
 */
export function limitSuggestedLabels(labels: Label[], selectedIds: string[]) {
  let suggestionsLeft = MAX_SUGGESTED_LABELS
  return labels.filter((label) => {
    if (selectedIds.includes(label.id)) return true
    if (suggestionsLeft === 0) return false
    suggestionsLeft -= 1
    return true
  })
}

/** Initial chips for a form: the record's own labels first, then recent labels as suggestions. */
export function mergeLabels(selected: Label[], recent: Label[]) {
  const merged = [...selected, ...recent.filter((recentLabel) => !selected.some((selectedLabel) => selectedLabel.id === recentLabel.id))]
  return limitSuggestedLabels(merged, selected.map((label) => label.id))
}
