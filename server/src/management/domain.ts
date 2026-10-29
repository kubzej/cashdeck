import {
  categoryDirections,
  categoryIconKeys,
  colorKeys,
  MAX_AMOUNT_CZK,
  MAX_NAME_LENGTH,
  walletTypes,
  type CategoryDirection,
  type CategoryIconKey,
  type ColorKey,
  type WalletType,
} from '../catalog.js'

export { categoryDirections, categoryIconKeys, colorKeys, walletTypes, type CategoryDirection, type CategoryIconKey, type ColorKey, type WalletType }

export class DomainError extends Error {
  constructor(
    readonly statusCode: 400 | 404 | 409,
    message: string,
  ) {
    super(message)
  }
}

export function normalizeWalletName(value: unknown) {
  return normalizeText(value, 'Název peněženky')
}

export function normalizeCategoryName(value: unknown) {
  const name = normalizeText(value, 'Název kategorie')
  const first = name.slice(0, 1)

  if (first.toLocaleLowerCase('cs-CZ') === first.toLocaleUpperCase('cs-CZ')) {
    throw new DomainError(400, 'Kategorie musí začínat písmenem.')
  }

  return `${first.toLocaleUpperCase('cs-CZ')}${name.slice(1)}`
}

export function normalizeLabelName(value: unknown) {
  return normalizeText(value, 'Název štítku').toLocaleLowerCase('cs-CZ')
}

export function parseCategoryDirection(value: unknown): CategoryDirection {
  if (typeof value === 'string' && (categoryDirections as readonly string[]).includes(value)) {
    return value as CategoryDirection
  }

  throw new DomainError(400, 'Směr kategorie musí být příjem nebo výdaj.')
}

export function parseColorKey(value: unknown): ColorKey {
  if (typeof value === 'string' && (colorKeys as readonly string[]).includes(value)) {
    return value as ColorKey
  }

  throw new DomainError(400, 'Barva není podporovaná.')
}

export function parseWalletType(value: unknown): WalletType {
  if (typeof value === 'string' && (walletTypes as readonly string[]).includes(value)) {
    return value as WalletType
  }

  throw new DomainError(400, 'Typ peněženky není podporovaný.')
}

export function parseCategoryIconKey(value: unknown): CategoryIconKey {
  if (typeof value === 'string' && (categoryIconKeys as readonly string[]).includes(value)) {
    return value as CategoryIconKey
  }

  throw new DomainError(400, 'Ikona není podporovaná.')
}

export function parseWholeCzk(value: unknown, field: string, options: { allowNegative: boolean }) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new DomainError(400, `${field} musí být celé číslo v Kč.`)
  }

  if (Math.abs(value) > MAX_AMOUNT_CZK) {
    throw new DomainError(400, `${field} je příliš velké číslo.`)
  }

  if (!options.allowNegative && value < 0) {
    throw new DomainError(400, `${field} nesmí být záporné.`)
  }

  return value
}

export function parseCalendarDate(value: unknown, field: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError(400, `${field} musí být datum ve formátu RRRR-MM-DD.`)
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new DomainError(400, `${field} není platné datum.`)
  }

  return value
}

export function parseUuid(value: unknown, field: string) {
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value
  }

  throw new DomainError(400, `${field} není platné ID.`)
}

export function parseOptionalBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new DomainError(400, `${field} musí být true nebo false.`)
  }

  return value
}

export function asRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError(400, 'Tělo požadavku musí být objekt.')
  }

  return value as Record<string, unknown>
}

export function assertOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new DomainError(400, `Pole ${key} není podporované.`)
    }
  }
}

function normalizeText(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new DomainError(400, `${field} je povinný.`)
  }

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized || normalized.length > MAX_NAME_LENGTH) {
    throw new DomainError(400, `${field} musí mít 1 až ${MAX_NAME_LENGTH} znaků.`)
  }

  return normalized
}
