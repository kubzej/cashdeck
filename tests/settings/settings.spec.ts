import { expect, test } from '@playwright/test'
import { openSignedInApp, testUser } from '../support/auth'

test('shows the signed-in email and signs out', async ({ page }) => {
  await openSignedInApp(page)
  await page.getByRole('button', { name: 'Nastavení' }).click()

  await expect(page.getByText('Přihlášený účet', { exact: true })).toBeVisible()
  await expect(page.getByText(testUser.email, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Odhlásit se' }).click()

  await expect(page.getByRole('heading', { name: 'Cashdeck', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).not.toBeVisible()
})
