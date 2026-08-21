import { expect, type Page } from '@playwright/test'
import { mockFeedApi } from './feed'
import { mockWalletsApi } from './wallets'
import { mockOverviewApi } from './overview'

export const testUser = {
  id: 'user-1',
}

export const testPassphrase = 'test-passphrase'

type AuthMockOptions = {
  signedIn?: boolean
}

export async function mockAuthAndApi(page: Page, { signedIn = false }: AuthMockOptions = {}) {
  let isAuthenticated = signedIn

  await page.route('http://api.test/api/unlock', async (route) => {
    const body = route.request().postDataJSON() as { passphrase?: string }
    if (body.passphrase !== testPassphrase) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Nesprávné heslo.' }) })
      return
    }

    isAuthenticated = true
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'token-1' }) })
  })

  await page.route('http://api.test/api/session', async (route) => {
    if (!isAuthenticated) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
      return
    }

    expect(route.request().headers().authorization).toBe('Bearer token-1')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ userId: testUser.id }),
    })
  })

  await mockFeedApi(page)
  await mockWalletsApi(page)
  await mockOverviewApi(page)
}

export async function signIn(page: Page) {
  await page.getByLabel('Heslo').fill(testPassphrase)
  await page.getByRole('button', { name: 'Odemknout' }).click()
  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
}

export async function openSignedInApp(page: Page) {
  await mockAuthAndApi(page)
  await page.goto('/')
  await signIn(page)
}
