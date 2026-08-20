import { expect, type Page, type Route } from '@playwright/test'

export type WalletFixture = {
  id: string
  name: string
  colorKey: string
  openingBalanceCzk: number
  openingBalanceDate: string
  sortOrder: number
  isHidden: boolean
  openingBalanceLocked: boolean
}

type WalletInput = Pick<WalletFixture, 'name' | 'colorKey' | 'openingBalanceCzk' | 'openingBalanceDate'>
type WalletRequestMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
type WalletApiFailure = { status: number; message: string }
type QueuedWalletApiFailure = WalletApiFailure & { remaining: number }

export type WalletApiMock = {
  failNext: (method: WalletRequestMethod, failure?: Partial<WalletApiFailure>) => void
  failTimes: (method: WalletRequestMethod, times: number, failure?: Partial<WalletApiFailure>) => void
  wallets: () => WalletFixture[]
}

export async function mockWalletsApi(page: Page, initialWallets: WalletFixture[] = []) {
  let wallets = [...initialWallets]
  let nextId = wallets.length + 1
  const failures = new Map<WalletRequestMethod, QueuedWalletApiFailure>()

  await page.route('http://api.test/api/wallets**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')

    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (await fulfillFailure(route, failures)) return

    if (request.method() === 'GET' && pathname === '/api/wallets') {
      await route.fulfill(json({ items: wallets }))
      return
    }

    if (request.method() === 'POST' && pathname === '/api/wallets') {
      const input = request.postDataJSON() as WalletInput
      const wallet: WalletFixture = {
        id: `wallet-${nextId++}`,
        ...input,
        sortOrder: wallets.length,
        isHidden: false,
        openingBalanceLocked: false,
      }
      wallets = [...wallets, wallet]
      await route.fulfill(json(wallet, 201))
      return
    }

    if (request.method() === 'PATCH') {
      const walletId = pathname.split('/').at(-1)
      const input = request.postDataJSON() as WalletInput
      wallets = wallets.map((wallet) => wallet.id === walletId ? { ...wallet, ...input } : wallet)
      const wallet = wallets.find((item) => item.id === walletId)
      await route.fulfill(wallet ? json(wallet) : json({ message: 'Peněženka neexistuje.' }, 404))
      return
    }

    if (request.method() === 'DELETE') {
      const walletId = pathname.split('/').at(-1)
      wallets = wallets.filter((wallet) => wallet.id !== walletId)
      await route.fulfill({ status: 204 })
      return
    }

    if (request.method() === 'PUT' && pathname === '/api/wallets/order') {
      const { walletIds } = request.postDataJSON() as { walletIds: string[] }
      wallets = walletIds.map((walletId, sortOrder) => {
        const wallet = wallets.find((item) => item.id === walletId)
        if (!wallet) throw new Error(`Neznámá peněženka ${walletId}`)
        return { ...wallet, sortOrder }
      })
      await route.fulfill({ status: 204 })
      return
    }

    await route.fulfill(json({ message: `Nepodporovaný wallet požadavek: ${request.method()} ${pathname}` }, 500))
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
    wallets: () => wallets.map((wallet) => ({ ...wallet })),
  } satisfies WalletApiMock
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function fulfillFailure(route: Route, failures: Map<WalletRequestMethod, QueuedWalletApiFailure>) {
  const method = route.request().method() as WalletRequestMethod
  const failure = failures.get(method)
  if (!failure) return false

  if (failure.remaining <= 1) failures.delete(method)
  else failures.set(method, { ...failure, remaining: failure.remaining - 1 })
  await route.fulfill(json({ message: failure.message }, failure.status))
  return true
}
