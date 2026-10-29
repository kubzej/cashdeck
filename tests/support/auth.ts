import { expect, type Page } from '@playwright/test'
import { mockFeedApi } from './feed'
import { mockWalletsApi } from './wallets'
import { mockOverviewApi } from './overview'
import { rejectUnauthorized, testToken } from './authorization'

export const testUser = {
  id: 'user-1',
}

export const testPassphrase = 'test-passphrase'

// The fixtures use fixed 2026 dates; without a fixed "today" they fall out of the current month
// as real time passes. Only Date is faked — timers (debounce, retries) keep running normally.
export const testToday = new Date('2026-08-21T10:00:00+02:00')

export async function mockAuthAndApi(page: Page) {
  let isAuthenticated = false
  await page.clock.setFixedTime(testToday)

  await page.route('http://api.test/api/unlock', async (route) => {
    const body = route.request().postDataJSON() as { passphrase?: string }
    if (body.passphrase !== testPassphrase) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Nesprávné heslo.' }) })
      return
    }

    isAuthenticated = true
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: testToken }) })
  })

  await page.route('http://api.test/api/session', async (route) => {
    if (!isAuthenticated) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
      return
    }

    if (await rejectUnauthorized(route)) return
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ userId: testUser.id, token: testToken }),
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
