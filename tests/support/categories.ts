import { expect, type Page, type Route } from '@playwright/test'

export type CategoryFixture = {
  id: string
  name: string
  direction: 'expense' | 'income'
  iconKey: string
  colorKey: string
  sortOrder: number
}

type CategoryInput = Pick<CategoryFixture, 'name' | 'direction' | 'iconKey' | 'colorKey'>
type CategoryUpdateInput = Omit<CategoryInput, 'direction'>
type CategoryRequestMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
type CategoryApiFailure = { status: number; message: string }
type QueuedCategoryApiFailure = CategoryApiFailure & { remaining: number }

export type CategoryApiMock = {
  categories: (direction?: CategoryFixture['direction']) => CategoryFixture[]
  failNext: (method: CategoryRequestMethod, failure?: Partial<CategoryApiFailure>) => void
  failTimes: (method: CategoryRequestMethod, times: number, failure?: Partial<CategoryApiFailure>) => void
}

export async function mockCategoriesApi(page: Page, initialCategories: CategoryFixture[] = []) {
  let categories = [...initialCategories]
  let nextId = categories.length + 1
  const failures = new Map<CategoryRequestMethod, QueuedCategoryApiFailure>()

  await page.route('http://api.test/api/categories**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')

    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (await fulfillFailure(route, failures)) return

    if (request.method() === 'GET' && pathname === '/api/categories') {
      await route.fulfill(json({ items: categories }))
      return
    }

    if (request.method() === 'POST' && pathname === '/api/categories') {
      const input = request.postDataJSON() as CategoryInput
      const category: CategoryFixture = {
        id: `category-${nextId++}`,
        ...input,
        sortOrder: categories.filter((item) => item.direction === input.direction).length,
      }
      categories = [...categories, category]
      await route.fulfill(json(category, 201))
      return
    }

    if (request.method() === 'PATCH') {
      const categoryId = pathname.split('/').at(-1)
      const input = request.postDataJSON() as CategoryUpdateInput
      categories = categories.map((category) => category.id === categoryId ? { ...category, ...input } : category)
      const category = categories.find((item) => item.id === categoryId)
      await route.fulfill(category ? json(category) : json({ message: 'Kategorie neexistuje.' }, 404))
      return
    }

    if (request.method() === 'DELETE') {
      const categoryId = pathname.split('/').at(-1)
      categories = categories.filter((category) => category.id !== categoryId)
      await route.fulfill({ status: 204 })
      return
    }

    if (request.method() === 'PUT') {
      const [, , , direction, order] = pathname.split('/')
      if (order !== 'order' || (direction !== 'expense' && direction !== 'income')) {
        await route.fulfill(json({ message: `Nepodporované řazení kategorií: ${pathname}` }, 500))
        return
      }

      const { categoryIds } = request.postDataJSON() as { categoryIds: string[] }
      const reordered = categoryIds.map((categoryId, sortOrder) => {
        const category = categories.find((item) => item.id === categoryId && item.direction === direction)
        if (!category) throw new Error(`Neznámá kategorie ${categoryId}`)
        return { ...category, sortOrder }
      })
      categories = [...categories.filter((category) => category.direction !== direction), ...reordered]
      await route.fulfill({ status: 204 })
      return
    }

    await route.fulfill(json({ message: `Nepodporovaný category požadavek: ${request.method()} ${pathname}` }, 500))
  })

  return {
    categories(direction) {
      return categories
        .filter((category) => direction === undefined || category.direction === direction)
        .map((category) => ({ ...category }))
    },
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
  } satisfies CategoryApiMock
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function fulfillFailure(route: Route, failures: Map<CategoryRequestMethod, QueuedCategoryApiFailure>) {
  const method = route.request().method() as CategoryRequestMethod
  const failure = failures.get(method)
  if (!failure) return false

  if (failure.remaining <= 1) failures.delete(method)
  else failures.set(method, { ...failure, remaining: failure.remaining - 1 })
  await route.fulfill(json({ message: failure.message }, failure.status))
  return true
}
