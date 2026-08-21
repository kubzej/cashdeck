import { expect, type Page } from '@playwright/test'
import type { IndependenceProgress, IndependenceSettings, IrregularExpense } from '../../src/features/independence/api'

const defaultProgress: IndependenceProgress = {
  hasSettings: false,
  annualExpensesCzk: 0,
  independenceNumberCzk: 0,
  totalWealthCzk: 0,
  availableWealthCzk: 0,
  totalProgressPercent: 0,
  availableProgressPercent: 0,
  yearsToTotal: null,
  yearsToAvailable: null,
  futureAnnualExpensesCzk: null,
  wealthByType: [],
  returnSensitivity: [],
}

export type IndependenceApiMock = {
  settings: () => IndependenceSettings | null
  irregularExpenses: () => IrregularExpense[]
}

export async function mockIndependenceApi(page: Page, options: {
  settings?: IndependenceSettings | null
  irregularExpenses?: IrregularExpense[]
  progress?: IndependenceProgress
  wealthSeries?: Array<{ date: string; amountCzk: number }>
} = {}) {
  let settings = options.settings ?? null
  let irregularExpenses = options.irregularExpenses ?? []
  let nextId = irregularExpenses.length + 1

  await page.route('http://api.test/api/independence/**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname === '/api/independence/settings') {
      await route.fulfill(json({ settings }))
      return
    }

    if (request.method() === 'PUT' && pathname === '/api/independence/settings') {
      settings = request.postDataJSON() as IndependenceSettings
      await route.fulfill(json({ settings }))
      return
    }

    if (request.method() === 'GET' && pathname === '/api/independence/irregular-expenses') {
      await route.fulfill(json({ items: irregularExpenses }))
      return
    }

    if (request.method() === 'POST' && pathname === '/api/independence/irregular-expenses') {
      const input = request.postDataJSON() as Omit<IrregularExpense, 'id' | 'sortOrder'>
      const item: IrregularExpense = { id: `irregular-${nextId++}`, sortOrder: irregularExpenses.length, ...input }
      irregularExpenses = [...irregularExpenses, item]
      await route.fulfill(json(item, 201))
      return
    }

    if (request.method() === 'PATCH' && pathname.startsWith('/api/independence/irregular-expenses/')) {
      const id = pathname.split('/').at(-1)
      const input = request.postDataJSON() as Partial<IrregularExpense>
      irregularExpenses = irregularExpenses.map((item) => item.id === id ? { ...item, ...input } : item)
      const item = irregularExpenses.find((entry) => entry.id === id)
      await route.fulfill(item ? json(item) : json({ message: 'Položka neexistuje.' }, 404))
      return
    }

    if (request.method() === 'DELETE' && pathname.startsWith('/api/independence/irregular-expenses/')) {
      const id = pathname.split('/').at(-1)
      const existed = irregularExpenses.some((item) => item.id === id)
      irregularExpenses = irregularExpenses.filter((item) => item.id !== id)
      await route.fulfill(existed ? { status: 204 } : json({ message: 'Položka neexistuje.' }, 404))
      return
    }

    if (request.method() === 'GET' && pathname === '/api/independence/progress') {
      await route.fulfill(json(options.progress ?? defaultProgress))
      return
    }

    if (request.method() === 'GET' && pathname === '/api/independence/wealth-series') {
      await route.fulfill(json({ points: options.wealthSeries ?? [] }))
      return
    }

    await route.fulfill(json({ message: `Nepodporovaný independence požadavek: ${request.method()} ${pathname}` }, 500))
  })

  return {
    settings: () => settings,
    irregularExpenses: () => irregularExpenses,
  } satisfies IndependenceApiMock
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}
