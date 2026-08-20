import { expect, type Page, type Route } from '@playwright/test'

export type LabelFixture = {
  id: string
  name: string
}

type LabelRequestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type LabelApiFailure = { status: number; message: string }
type QueuedLabelApiFailure = LabelApiFailure & { remaining: number }

export type LabelApiMock = {
  labels: () => LabelFixture[]
  failNext: (method: LabelRequestMethod, failure?: Partial<LabelApiFailure>) => void
  failTimes: (method: LabelRequestMethod, times: number, failure?: Partial<LabelApiFailure>) => void
}

export async function mockLabelsApi(page: Page, initialLabels: LabelFixture[] = []) {
  let labels = [...initialLabels]
  let nextId = labels.length + 1
  const failures = new Map<LabelRequestMethod, QueuedLabelApiFailure>()

  await page.route('http://api.test/api/labels**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (await fulfillFailure(route, failures)) return

    if (request.method() === 'GET' && pathname === '/api/labels') {
      const query = url.searchParams.get('q')?.toLocaleLowerCase('cs-CZ') ?? ''
      const limit = Number(url.searchParams.get('limit') ?? '50')
      const cursor = Number(url.searchParams.get('cursor')?.replace('cursor-', '') ?? '0')
      const matching = labels.filter((label) => label.name.includes(query)).sort((first, second) => first.name.localeCompare(second.name, 'cs-CZ'))
      const items = matching.slice(cursor, cursor + limit)
      const nextCursor = cursor + limit < matching.length ? `cursor-${cursor + limit}` : null
      await route.fulfill(json({ items, nextCursor }))
      return
    }

    if (request.method() === 'POST' && pathname === '/api/labels') {
      const { name } = request.postDataJSON() as { name: string }
      const label = { id: `label-${nextId++}`, name }
      labels = [...labels, label]
      await route.fulfill(json(label, 201))
      return
    }

    if (request.method() === 'PATCH') {
      const labelId = pathname.split('/').at(-1)
      const { name } = request.postDataJSON() as { name: string }
      labels = labels.map((label) => label.id === labelId ? { ...label, name } : label)
      const label = labels.find((item) => item.id === labelId)
      await route.fulfill(label ? json(label) : json({ message: 'Štítek neexistuje.' }, 404))
      return
    }

    if (request.method() === 'DELETE') {
      const labelId = pathname.split('/').at(-1)
      labels = labels.filter((label) => label.id !== labelId)
      await route.fulfill({ status: 204 })
      return
    }

    await route.fulfill(json({ message: `Nepodporovaný label požadavek: ${request.method()} ${pathname}` }, 500))
  })

  return {
    labels: () => labels.map((label) => ({ ...label })),
    failNext(method, failure = {}) {
      this.failTimes(method, 1, failure)
    },
    failTimes(method, times, failure = {}) {
      failures.set(method, {
        remaining: times,
        status: failure.status ?? 500,
        message: failure.message ?? 'Požadavek se nepodařilo dokončit.',
      })
    },
  } satisfies LabelApiMock
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function fulfillFailure(route: Route, failures: Map<LabelRequestMethod, QueuedLabelApiFailure>) {
  const method = route.request().method() as LabelRequestMethod
  const failure = failures.get(method)
  if (!failure) return false

  if (failure.remaining <= 1) failures.delete(method)
  else failures.set(method, { ...failure, remaining: failure.remaining - 1 })
  await route.fulfill(json({ message: failure.message }, failure.status))
  return true
}
