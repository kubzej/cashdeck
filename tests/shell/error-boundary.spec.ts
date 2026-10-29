import { expect, test } from '@playwright/test'
import { openSignedInApp } from '../support/auth'

test('a screen that cannot be loaded shows a recovery message and the navigation keeps working', async ({ page }) => {
  // Same effect as a lazy screen whose file is gone after a deploy: the import fails.
  await page.route('**/features/overview/overview-screen**', (route) => route.abort('failed'))
  await openSignedInApp(page)

  const navigation = page.locator('.bottom-nav')
  await navigation.getByRole('button', { name: 'Přehled', exact: true }).click()

  await expect(page.getByText('Tuto obrazovku se nepodařilo zobrazit', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Načíst znovu' })).toBeVisible()
  await expect(navigation).toBeVisible()

  await navigation.getByRole('button', { name: 'Peněženky', exact: true }).click()
  await expect(page.getByText('Tuto obrazovku se nepodařilo zobrazit', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Peněženky', exact: true })).toBeVisible()
})

test('"Načíst znovu" reloads the page, which fetches the current version of the screen', async ({ page }) => {
  let blocked = true
  await page.route('**/features/overview/overview-screen**', (route) => blocked ? route.abort('failed') : route.fallback())
  await openSignedInApp(page)
  const navigation = page.locator('.bottom-nav')
  await navigation.getByRole('button', { name: 'Přehled', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Načíst znovu' })).toBeVisible()

  blocked = false
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Načíst znovu' }).click()])

  await expect(page.getByText('Přihlášení není dostupné', { exact: true })).toHaveCount(0)
  await navigation.getByRole('button', { name: 'Přehled', exact: true }).click()
  await expect(page.getByText('Celkové bohatství', { exact: true })).toBeVisible()
})
