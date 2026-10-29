import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'

test('shows the passphrase form before unlocking', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Cashdeck', exact: true })).toBeVisible()
  await expect(page.getByLabel('Heslo')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).not.toBeVisible()
})

test('rejects an incorrect passphrase with a visible error', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')

  await page.getByLabel('Heslo').fill('wrong-passphrase')
  await page.getByRole('button', { name: 'Odemknout' }).click()

  await expect(page.getByText('Nesprávné heslo.')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).not.toBeVisible()
})

test('unlocks and verifies the backend session with the bearer token', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')

  await signIn(page)

  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()
})

test('keeps the session across a page reload instead of bouncing back to the login screen', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')
  await signIn(page)

  await page.reload()

  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()
  await expect(page.getByLabel('Heslo')).toHaveCount(0)
})

test('keeps the stored token when the session response carries no renewed one', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')
  await signIn(page)
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()

  await page.route('http://api.test/api/session', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ userId: 'user-1' }) }))
  await page.reload()

  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cashdeck-session-token'))).toBe('token-1')
})

test('stays signed in and offers a retry when the session check fails for a non-auth reason', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')
  await signIn(page)

  await page.route('http://api.test/api/session', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Interní chyba serveru.' }) }))
  await page.reload()

  await expect(page.getByText('Přihlášení není dostupné')).toBeVisible()
  await expect(page.getByText('Server právě neodpovídá. Zkus to za chvíli.')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cashdeck-session-token'))).toBe('token-1')

  await page.unroute('http://api.test/api/session')
  await page.route('http://api.test/api/session', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ userId: 'user-1', token: 'token-1' }) }))
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()

  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()
})

test('a network failure during the session check keeps the token and shows the retry screen', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')
  await signIn(page)

  await page.route('http://api.test/api/session', (route) => route.abort('failed'))
  await page.reload()

  await expect(page.getByText('Přihlášení není dostupné')).toBeVisible()
  await expect(page.getByText('Zkontroluj připojení a zkus to znovu.')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cashdeck-session-token'))).toBe('token-1')
})

test('a 401 from the session check signs out and clears the stored token', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')
  await signIn(page)

  await page.route('http://api.test/api/session', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) }))
  await page.reload()

  await expect(page.getByLabel('Heslo')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cashdeck-session-token'))).toBeNull()
})

test('a 401 on any request while the app is open returns to the passphrase screen and clears the token', async ({ page }) => {
  await mockAuthAndApi(page)
  await page.goto('/')
  await signIn(page)

  // Labels are requested only once their screen opens, so the 401 lands after a deliberate click.
  await page.route('http://api.test/api/labels**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) }))
  await page.locator('.bottom-nav').getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Štítky/ }).click()

  await expect(page.getByLabel('Heslo')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cashdeck-session-token'))).toBeNull()
})
