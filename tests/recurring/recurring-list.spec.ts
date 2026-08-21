import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockRecurringRulesApi } from '../support/recurring'

test('shows the error state and recovers after retrying a failed recurring rules load', async ({ page }) => {
  await mockAuthAndApi(page)
  const recurringApi = await mockRecurringRulesApi(page, [])
  recurringApi.failNext('GET', { message: 'Dočasně nedostupné.' })
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: /Opakování/ }).click()

  await expect(page.getByText('Opakování se nepodařilo načíst', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()

  await expect(page.getByText('Bez opakování', { exact: true })).toBeVisible()
})
