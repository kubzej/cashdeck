import { expect, test } from '@playwright/test'
import { openSignedInApp } from '../support/auth'

test('switches between all signed-in destinations', async ({ page }) => {
  await openSignedInApp(page)

  const destinations = [
    ['Peněženky', 'Zatím bez peněženek'],
    ['Přehled', 'Zatím bez přehledu'],
    ['Nastavení', null],
    ['Transakce', 'Zatím bez transakcí'],
  ] as const

  for (const [label, placeholder] of destinations) {
    await page.getByRole('button', { name: label }).click()
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page')

    if (placeholder) {
      await expect(page.getByText(placeholder, { exact: true })).toBeVisible()
    }
  }
})
