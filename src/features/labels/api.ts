import { apiRequest } from '../../lib/api-client'

export type Label = {
  id: string
  name: string
}

export type LabelPage = {
  items: Label[]
  nextCursor: string | null
}

export async function listLabels({ query, cursor, limit = 50 }: { query?: string; cursor?: string; limit?: number } = {}) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (query) search.set('q', query)
  if (cursor) search.set('cursor', cursor)
  return apiRequest<LabelPage>(`/labels?${search.toString()}`)
}

export async function createLabel(name: string) {
  return apiRequest<Label>('/labels', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function updateLabel(labelId: string, name: string) {
  return apiRequest<Label>(`/labels/${labelId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function deleteLabel(labelId: string) {
  await apiRequest<void>(`/labels/${labelId}`, { method: 'DELETE' })
}
