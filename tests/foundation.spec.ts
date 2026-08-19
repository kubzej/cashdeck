import { expect, test } from '@playwright/test'

test('renders the shell, switches destinations, and persists the theme', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Transakce' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await expect(page.getByRole('heading', { name: 'Peněženky' })).toBeVisible()

  await page.getByRole('button', { name: 'Přepnout na tmavý motiv' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('button', { name: 'Přepnout na světlý motiv' })).toBeVisible()
})
