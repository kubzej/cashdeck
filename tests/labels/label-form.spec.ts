import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockLabelsApi, type LabelFixture } from '../support/labels'

test('validates, normalizes, and retries label creation', async ({ page }) => {
  await mockAuthAndApi(page)
  const labelApi = await mockLabelsApi(page)
  await page.goto('/')
  await signIn(page)
  await openLabels(page)

  await page.getByRole('button', { name: 'Přidat štítek' }).click()
  await page.getByRole('button', { name: 'Uložit štítek' }).click()
  await expect(page.getByText('Zadej název štítku.', { exact: true })).toBeVisible()

  await page.getByLabel('Název').fill('FoundationGalaxy')
  await expect(page.getByLabel('Název')).toHaveValue('foundationgalaxy')
  labelApi.failNext('POST', { message: 'Uložení je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit štítek' }).click()
  await expect(page.getByText('Štítek se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit štítek' }).click()
  await expect.poll(() => labelApi.labels()).toEqual([expect.objectContaining({ name: 'foundationgalaxy' })])
  await expect(page.getByRole('button', { name: 'foundationgalaxy' })).toBeVisible()
})

test('edits an existing label', async ({ page }) => {
  const label: LabelFixture = { id: 'label-1', name: 'globus' }
  await mockAuthAndApi(page)
  const labelApi = await mockLabelsApi(page, [label])
  await page.goto('/')
  await signIn(page)
  await openLabels(page)

  await page.getByRole('button', { name: 'globus' }).click()
  await expect(page.getByRole('heading', { name: 'Upravit štítek' })).toBeVisible()
  await page.getByLabel('Název').fill('Globus Plus')
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect.poll(() => labelApi.labels()[0]).toMatchObject({ name: 'globus plus' })
})

async function openLabels(page: Parameters<typeof mockAuthAndApi>[0]) {
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('button', { name: /Štítky/ }).click()
}
