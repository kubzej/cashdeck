import { expect, type Page, type Route } from '@playwright/test'
import type { Transfer, TransferInput } from '../../src/features/transfers/api'

export type TransferApiMock = {
  failNext: (method: TransferRequestMethod, failure?: Partial<TransferApiFailure>) => void
  transfers: () => Transfer[]
}

type TransferRequestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type TransferApiFailure = { status: number; message: string }
type QueuedTransferApiFailure = TransferApiFailure & { remaining: number }

export async function mockTransfersApi(page: Page, initialTransfers: Transfer[] = []) {
  let transfers = [...initialTransfers]
  let nextId = transfers.length + 1
  const failures = new Map<TransferRequestMethod, QueuedTransferApiFailure>()

  await page.route('http://api.test/api/transfers**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')

    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    if (await fulfillFailure(route, failures)) return

    if (request.method() === 'GET' && pathname === '/api/transfers') {
      const limit = Number(url.searchParams.get('limit') ?? '50')
      const start = Number(url.searchParams.get('cursor')?.replace('cursor-', '') ?? '0')
      const items = transfers.slice(start, start + limit)
      const nextCursor = start + limit < transfers.length ? `cursor-${start + limit}` : null
      await route.fulfill(json({ items, nextCursor }))
      return
    }

    if (request.method() === 'POST' && pathname === '/api/transfers') {
      const input = request.postDataJSON() as TransferInput
      const transfer: Transfer = {
        id: `transfer-${nextId++}`,
        sourceWalletId: input.sourceWalletId,
        sourceWalletName: input.sourceWalletId,
        destinationWalletId: input.destinationWalletId,
        destinationWalletName: input.destinationWalletId,
        amountCzk: input.amountCzk,
        transferDate: input.transferDate,
        note: input.note,
        labels: input.labelIds.map((id) => ({ id, name: id })),
      }
      transfers = [transfer, ...transfers]
      await route.fulfill(json(transfer, 201))
      return
    }

    if (request.method() === 'PATCH') {
      const transferId = pathname.split('/').at(-1)
      const input = request.postDataJSON() as TransferInput
      const previous = transfers.find((transfer) => transfer.id === transferId)
      if (!previous) {
        await route.fulfill(json({ message: 'Převod neexistuje.' }, 404))
        return
      }
      const transfer: Transfer = { ...previous, ...input, labels: input.labelIds.map((id) => ({ id, name: id })) }
      transfers = transfers.map((item) => item.id === transferId ? transfer : item)
      await route.fulfill(json(transfer))
      return
    }

    if (request.method() === 'DELETE') {
      const transferId = pathname.split('/').at(-1)
      transfers = transfers.filter((transfer) => transfer.id !== transferId)
      await route.fulfill({ status: 204 })
      return
    }

    await route.fulfill(json({ message: `Nepodporovaný transfer požadavek: ${request.method()} ${pathname}` }, 500))
  })

  return {
    failNext(method, failure = {}) {
      failures.set(method, { remaining: 1, status: failure.status ?? 500, message: failure.message ?? 'Požadavek se nepodařilo dokončit.' })
    },
    transfers: () => transfers.map((transfer) => ({ ...transfer, labels: [...transfer.labels] })),
  } satisfies TransferApiMock
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

async function fulfillFailure(route: Route, failures: Map<TransferRequestMethod, QueuedTransferApiFailure>) {
  const method = route.request().method() as TransferRequestMethod
  const failure = failures.get(method)
  if (!failure) return false

  failures.delete(method)
  await route.fulfill(json({ message: failure.message }, failure.status))
  return true
}
