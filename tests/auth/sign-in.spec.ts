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
