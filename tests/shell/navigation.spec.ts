import { expect, test } from '@playwright/test'
import { openSignedInApp } from '../support/auth'

test('switches between all signed-in destinations', async ({ page }) => {
  await openSignedInApp(page)

  const destinations = [
    ['Peněženky', 'Zatím bez peněženek'],
    ['Přehled', 'Celkové bohatství'],
    ['Nastavení', null],
    ['Transakce', 'Zatím bez transakcí'],
  ] as const

  for (const [label, placeholder] of destinations) {
    const navigationItem = page.locator('.bottom-nav').getByRole('button', { name: label, exact: true })
    await navigationItem.click()
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
    await expect(navigationItem).toHaveAttribute('aria-current', 'page')

    if (placeholder) {
      await expect(page.getByText(placeholder, { exact: true })).toBeVisible()
    }
  }
})
