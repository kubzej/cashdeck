import { expect, type Page } from '@playwright/test'
import { mockWalletsApi } from './wallets'
import { mockTransfersApi } from './transfers'
import { mockTransactionsApi } from './transactions'

export const testUser = {
  id: 'user-1',
  email: 'jakub@example.com',
  name: 'Jakub',
}

type AuthMockOptions = {
  signedIn?: boolean
}

export async function mockAuthAndApi(page: Page, { signedIn = false }: AuthMockOptions = {}) {
  let isAuthenticated = signedIn

  await page.route('http://neon.test/auth/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname

    if (pathname.endsWith('/get-session')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          session: isAuthenticated ? { id: 'session-1', userId: testUser.id, token: 'token-1' } : null,
          user: isAuthenticated ? testUser : null,
        }),
      })
      return
    }

    if (pathname.endsWith('/sign-in/email')) {
      isAuthenticated = true
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: testUser }) })
      return
    }

    if (pathname.endsWith('/sign-out')) {
      isAuthenticated = false
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) })
      return
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) })
  })

  await page.route('http://api.test/api/session', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ userId: testUser.id }),
    })
  })
}

export async function signIn(page: Page) {
  await page.getByLabel('Email').fill(testUser.email)
  await page.getByLabel('Heslo').fill('secure-password')
  await page.getByRole('button', { name: 'Přihlásit se' }).click()
  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
}

export async function openSignedInApp(page: Page) {
  await mockAuthAndApi(page)
  await mockWalletsApi(page)
  await mockTransactionsApi(page)
  await mockTransfersApi(page)
  await page.goto('/')
  await signIn(page)
}
