import { MAX_NOTE_LENGTH } from './catalog.js'
import { DomainError, parseUuid, parseWholeCzk } from './management/domain.js'

// Request-input parsers and DB-row helpers shared by every feature module. They used to be
// copied per module; identical bounds and messages matter, so there is one definition.

export type LabelRef = { id: string; name: string }

export function parseWalletIds(value: unknown) {
  if (typeof value !== 'string' || !value) throw new DomainError(400, 'Výběr peněženek není platný.')
  const walletIds = value.split(',')
  if (walletIds.length > 50 || walletIds.some((walletId) => !walletId)) throw new DomainError(400, 'Výběr peněženek není platný.')
  const parsed = walletIds.map((walletId) => parseUuid(walletId, 'Peněženka'))
  if (new Set(parsed).size !== parsed.length) throw new DomainError(400, 'Výběr peněženek obsahuje duplicitu.')
  return parsed
}

export function parseSearch(value: unknown) {
  if (typeof value !== 'string') throw new DomainError(400, 'Hledání není platné.')
  const search = value.trim()
  if (!search) return null
  if (search.length > 100) throw new DomainError(400, 'Hledání může mít nejvýše 100 znaků.')
  return search
}

export function parseLimit(value: unknown) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new DomainError(400, 'Parametr limit není platný.')
  const limit = Number(value)
  if (limit < 1 || limit > 100) throw new DomainError(400, 'Parametr limit musí být mezi 1 a 100.')
  return limit
}

export function parsePositiveAmount(value: unknown) {
  const amount = parseWholeCzk(value, 'Částka', { allowNegative: false })
  if (amount < 1) throw new DomainError(400, 'Částka musí být alespoň 1 Kč.')
  return amount
}

export function parseOptionalNote(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new DomainError(400, 'Poznámka musí být text.')
  const note = value.trim()
  if (!note) return null
  if (note.length > MAX_NOTE_LENGTH) throw new DomainError(400, `Poznámka může mít nejvýše ${MAX_NOTE_LENGTH} znaků.`)
  return note
}

/** Strict: the value must be present. Callers that treat missing labels as "none" default before calling. */
export function parseLabelIds(value: unknown) {
  if (!Array.isArray(value)) throw new DomainError(400, 'Štítky musí být seznam ID.')
  const labelIds = value.map((labelId) => parseUuid(labelId, 'Štítek'))
  if (labelIds.length !== new Set(labelIds).size) throw new DomainError(400, 'Štítky se nesmí opakovat.')
  return labelIds
}

/** Reads the `json_agg` label column of a query row; malformed entries are dropped. */
export function parseLabels(value: unknown): LabelRef[] {
  const labels = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(labels)) return []
  return labels.filter((label): label is LabelRef => typeof label === 'object' && label !== null && 'id' in label && 'name' in label && typeof label.id === 'string' && typeof label.name === 'string')
}

/**
 * Makes user text literal inside a LIKE/ILIKE pattern. `%` and `_` are wildcards and `\` is
 * Postgres's default escape character, so all three need a backslash in front.
 */
export function escapeLikePattern(text: string) {
  return text.replace(/[\\%_]/g, '\\$&')
}
