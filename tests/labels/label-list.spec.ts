import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockLabelsApi, type LabelFixture } from '../support/labels'

test('shows the empty state after retrying a failed label load', async ({ page }) => {
  await mockAuthAndApi(page)
  const labelApi = await mockLabelsApi(page)
  labelApi.failNext('GET', { message: 'Dočasně nedostupné.' })
  await page.goto('/')
  await signIn(page)
  await openLabels(page)

  await expect(page.getByText('Štítky se nepodařilo načíst', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()
  await expect(page.getByText('Bez štítků', { exact: true })).toBeVisible()
})

test('searches labels alphabetically and loads the next page', async ({ page }) => {
  const labels = [
    label('1', 'zara'), label('2', 'alza'), label('3', 'globus'),
    ...Array.from({ length: 49 }, (_, index) => label(`many-${index}`, `label-${String(index).padStart(2, '0')}`)),
  ]
  await mockAuthAndApi(page)
  await mockLabelsApi(page, labels)
  await page.goto('/')
  await signIn(page)
  await openLabels(page)

  await expect(page.getByRole('button', { name: 'alza' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Načíst další' })).toBeVisible()
  await page.getByRole('button', { name: 'Načíst další' }).click()
  await expect(page.getByRole('button', { name: 'zara' })).toBeVisible()

  await page.getByLabel('Hledat štítky').fill('glob')
  await expect(page.getByRole('button', { name: 'globus' })).toBeVisible()
})

async function openLabels(page: Parameters<typeof mockAuthAndApi>[0]) {
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('button', { name: /Štítky/ }).click()
}

function label(id: string, name: string): LabelFixture {
  return { id, name }
}
