export const categoryDirections = ['income', 'expense'] as const
export type CategoryDirection = (typeof categoryDirections)[number]

export const colorKeys = [
  'slate',
  'red',
  'orange',
  'amber',
  'lime',
  'green',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'pink',
  'rose',
] as const
export type ColorKey = (typeof colorKeys)[number]

export const categoryIconKeys = [
  'house',
  'landmark',
  'repeat-2',
  'dumbbell',
  'cigarette',
  'flag',
  'heart-handshake',
  'graduation-cap',
  'clapperboard',
  'gift',
  'shirt',
  'smartphone',
  'heart-pulse',
  'shopping-basket',
  'plane',
  'party-popper',
  'tram-front',
  'receipt-text',
  'utensils',
  'briefcase-business',
  'car-front',
  'ellipsis',
  'banknote-arrow-up',
  'rotate-ccw',
  'circle-plus',
  'hand-coins',
  'tags',
  'wallet-cards',
] as const
export type CategoryIconKey = (typeof categoryIconKeys)[number]

export type DefaultCategory = {
  name: string
  direction: CategoryDirection
  iconKey: CategoryIconKey
  colorKey: ColorKey
}

export const defaultCategories: readonly DefaultCategory[] = [
  { name: 'Domov', direction: 'expense', iconKey: 'house', colorKey: 'orange' },
  { name: 'Hypotéka', direction: 'expense', iconKey: 'landmark', colorKey: 'amber' },
  { name: 'Předplatné', direction: 'expense', iconKey: 'repeat-2', colorKey: 'violet' },
  { name: 'Sport', direction: 'expense', iconKey: 'dumbbell', colorKey: 'green' },
  { name: 'Cigarety', direction: 'expense', iconKey: 'cigarette', colorKey: 'slate' },
  { name: 'Slavia', direction: 'expense', iconKey: 'flag', colorKey: 'red' },
  { name: 'Dar', direction: 'expense', iconKey: 'heart-handshake', colorKey: 'rose' },
  { name: 'Vzdělávání', direction: 'expense', iconKey: 'graduation-cap', colorKey: 'sky' },
  { name: 'Zábava', direction: 'expense', iconKey: 'clapperboard', colorKey: 'violet' },
  { name: 'Dárek', direction: 'expense', iconKey: 'gift', colorKey: 'pink' },
  { name: 'Oblečení', direction: 'expense', iconKey: 'shirt', colorKey: 'cyan' },
  { name: 'Elektronika', direction: 'expense', iconKey: 'smartphone', colorKey: 'blue' },
  { name: 'Zdraví', direction: 'expense', iconKey: 'heart-pulse', colorKey: 'red' },
  { name: 'Nákup', direction: 'expense', iconKey: 'shopping-basket', colorKey: 'teal' },
  { name: 'Dovolená', direction: 'expense', iconKey: 'plane', colorKey: 'sky' },
  { name: 'Párty', direction: 'expense', iconKey: 'party-popper', colorKey: 'pink' },
  { name: 'MHD', direction: 'expense', iconKey: 'tram-front', colorKey: 'indigo' },
  { name: 'Účty', direction: 'expense', iconKey: 'receipt-text', colorKey: 'cyan' },
  { name: 'Restaurace', direction: 'expense', iconKey: 'utensils', colorKey: 'orange' },
  { name: 'Práce', direction: 'expense', iconKey: 'briefcase-business', colorKey: 'blue' },
  { name: 'Auto', direction: 'expense', iconKey: 'car-front', colorKey: 'slate' },
  { name: 'Ostatní', direction: 'expense', iconKey: 'ellipsis', colorKey: 'slate' },
  { name: 'Výplata', direction: 'income', iconKey: 'banknote-arrow-up', colorKey: 'green' },
  { name: 'Dárek', direction: 'income', iconKey: 'gift', colorKey: 'pink' },
  { name: 'Refundace', direction: 'income', iconKey: 'rotate-ccw', colorKey: 'cyan' },
  { name: 'Extra příjem', direction: 'income', iconKey: 'circle-plus', colorKey: 'teal' },
  { name: 'Dar', direction: 'income', iconKey: 'heart-handshake', colorKey: 'rose' },
  { name: 'Prodej', direction: 'income', iconKey: 'tags', colorKey: 'orange' },
  { name: 'Ostatní', direction: 'income', iconKey: 'ellipsis', colorKey: 'slate' },
]

export function defaultCategorySeeds() {
  const nextSortOrder: Record<CategoryDirection, number> = { income: 0, expense: 0 }

  return defaultCategories.map((category) => {
    const sortOrder = nextSortOrder[category.direction]
    nextSortOrder[category.direction] += 1
    return { ...category, sortOrder }
  })
}

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

  const normalized = value.trim()
  if (!normalized || normalized.length > 120) {
    throw new DomainError(400, `${field} musí mít 1 až 120 znaků.`)
  }

  return normalized
}
