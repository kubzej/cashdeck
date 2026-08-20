import { expect, type Page, type Route } from '@playwright/test'
import type { CreateTransactionInput, Transaction } from '../../src/features/transactions/api'

export type TransactionApiMock = {
  failNext: (method: TransactionRequestMethod, failure?: Partial<TransactionApiFailure>) => void
  failTimes: (method: TransactionRequestMethod, times: number, failure?: Partial<TransactionApiFailure>) => void
  transactions: () => Transaction[]
}

type TransactionRequestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type TransactionApiFailure = { status: number; message: string }
type QueuedTransactionApiFailure = TransactionApiFailure & { remaining: number }

export async function mockTransactionsApi(page: Page, initialTransactions: Transaction[] = []) {
  let transactions = [...initialTransactions]
  let nextId = transactions.length + 1
  const failures = new Map<TransactionRequestMethod, QueuedTransactionApiFailure>()

  await page.route('http://api.test/api/transactions**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')

    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (await fulfillFailure(route, failures)) return

    if (request.method() === 'GET' && pathname === '/api/transactions') {
      const limit = Number(url.searchParams.get('limit') ?? '50')
      const start = Number(url.searchParams.get('cursor')?.replace('cursor-', '') ?? '0')
      const items = transactions.slice(start, start + limit)
      const nextCursor = start + limit < transactions.length ? `cursor-${start + limit}` : null
      await route.fulfill(json({ items, nextCursor }))
      return
    }

    if (request.method() === 'POST' && pathname === '/api/transactions') {
      const input = request.postDataJSON() as CreateTransactionInput
      const transaction: Transaction = {
        id: `transaction-${nextId++}`,
        walletId: input.walletId,
        walletName: 'Testovací peněženka',
        categoryId: input.categoryId,
        categoryName: 'Testovací kategorie',
        categoryIconKey: 'tags',
        categoryColorKey: 'teal',
        direction: 'expense',
        amountCzk: input.amountCzk,
        transactionDate: input.transactionDate,
        note: input.note,
        labels: input.labelIds.map((id) => ({ id, name: id })),
      }
      transactions = [transaction, ...transactions]
      await route.fulfill(json(transaction, 201))
      return
    }

    if (request.method() === 'PATCH') {
      const transactionId = pathname.split('/').at(-1)
      const input = request.postDataJSON() as CreateTransactionInput
      const previous = transactions.find((transaction) => transaction.id === transactionId)
      if (!previous) {
        await route.fulfill(json({ message: 'Transakce neexistuje.' }, 404))
        return
      }
      const transaction: Transaction = {
        ...previous,
        walletId: input.walletId,
        categoryId: input.categoryId,
        amountCzk: input.amountCzk,
        transactionDate: input.transactionDate,
        note: input.note,
      }
      transactions = transactions.map((item) => item.id === transactionId ? transaction : item)
      await route.fulfill(json(transaction))
      return
    }

    if (request.method() === 'DELETE') {
      const transactionId = pathname.split('/').at(-1)
      transactions = transactions.filter((transaction) => transaction.id !== transactionId)
      await route.fulfill({ status: 204 })
      return
    }

    await route.fulfill(json({ message: `Nepodporovaný transaction požadavek: ${request.method()} ${pathname}` }, 500))
  })

  return {
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
    transactions: () => transactions.map((transaction) => ({ ...transaction, labels: [...transaction.labels] })),
  } satisfies TransactionApiMock
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function fulfillFailure(route: Route, failures: Map<TransactionRequestMethod, QueuedTransactionApiFailure>) {
  const method = route.request().method() as TransactionRequestMethod
  const failure = failures.get(method)
  if (!failure) return false

  if (failure.remaining <= 1) failures.delete(method)
  else failures.set(method, { ...failure, remaining: failure.remaining - 1 })
  await route.fulfill(json({ message: failure.message }, failure.status))
  return true
}
