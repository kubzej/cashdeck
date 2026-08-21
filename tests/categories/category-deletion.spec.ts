import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi, type CategoryApiMock, type CategoryFixture } from '../support/categories'

const category: CategoryFixture = {
  id: 'category-1', name: 'Domov', direction: 'expense', iconKey: 'house', colorKey: 'teal', sortOrder: 0,
}

test('keeps a category when deletion is cancelled', async ({ page }) => {
  await openCategoryEdit(page)

  await page.getByRole('button', { name: 'Smazat kategorii' }).click()
  await page.getByRole('button', { name: 'Zrušit' }).click()

  await expect(page.getByRole('heading', { name: 'Upravit kategorii' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Smazat kategorii' })).toBeVisible()
})

test('shows a deletion error and removes the category after retrying confirmation', async ({ page }) => {
  const categoryApi = await openCategoryEdit(page)
  categoryApi.failNext('DELETE', { message: 'Smazání je dočasně nedostupné.' })

  await page.getByRole('button', { name: 'Smazat kategorii' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Kategorii se nepodařilo smazat', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Zrušit' }).click()
  await page.getByRole('button', { name: 'Smazat kategorii' }).click()
  await page.getByRole('button', { name: 'Smazat', exact: true }).click()
  await expect(page.getByText('Bez kategorií', { exact: true })).toBeVisible()
})

async function openCategoryEdit(page: Parameters<typeof mockAuthAndApi>[0]): Promise<CategoryApiMock> {
  await mockAuthAndApi(page)
  const categoryApi = await mockCategoriesApi(page, [category])
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('button', { name: /Kategorie/ }).click()
  await page.getByRole('listitem').filter({ hasText: category.name }).click()
  return categoryApi
}
