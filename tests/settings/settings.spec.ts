import { expect, test } from '@playwright/test'
import { openSignedInApp } from '../support/auth'

test('shows the access-protection status and signs out', async ({ page }) => {
  await openSignedInApp(page)
  await page.getByRole('button', { name: 'Nastavení' }).click()

  await expect(page.getByText('Přístup k aplikaci', { exact: true })).toBeVisible()
  await expect(page.getByText('Chráněno heslem', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Odhlásit se' }).click()

  await expect(page.getByRole('heading', { name: 'Cashdeck', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).not.toBeVisible()

  // Sign-out clears the token from client storage, not just the in-memory UI state — a reload
  // must not silently restore the session from a stale token.
  await page.reload()
  await expect(page.getByLabel('Heslo')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).not.toBeVisible()
})
