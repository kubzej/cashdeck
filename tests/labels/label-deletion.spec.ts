import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockLabelsApi, type LabelApiMock, type LabelFixture } from '../support/labels'

const label: LabelFixture = { id: 'label-1', name: 'globus' }

test('keeps a label when deletion is cancelled', async ({ page }) => {
  await openLabelEdit(page)
  await page.getByRole('button', { name: 'Smazat štítek' }).click()
  await page.getByRole('button', { name: 'Zrušit' }).click()
  await expect(page.getByRole('heading', { name: 'Upravit štítek' })).toBeVisible()
})

test('shows a deletion error and removes the label after retrying confirmation', async ({ page }) => {
  const labelApi = await openLabelEdit(page)
  labelApi.failNext('DELETE', { message: 'Smazání je dočasně nedostupné.' })

  await page.getByRole('button', { name: 'Smazat štítek' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Štítek se nepodařilo smazat', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Zrušit' }).click()
  await page.getByRole('button', { name: 'Smazat štítek' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Bez štítků', { exact: true })).toBeVisible()
})

async function openLabelEdit(page: Parameters<typeof mockAuthAndApi>[0]): Promise<LabelApiMock> {
  await mockAuthAndApi(page)
  const labelApi = await mockLabelsApi(page, [label])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('button', { name: /Štítky/ }).click()
  await page.getByRole('button', { name: label.name }).click()
  return labelApi
}
