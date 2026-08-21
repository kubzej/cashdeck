import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi, type CategoryFixture } from '../support/categories'

test('shows the empty state after retrying a failed category load', async ({ page }) => {
  await mockAuthAndApi(page)
  const categoryApi = await mockCategoriesApi(page)
  categoryApi.failNext('GET', { message: 'Dočasně nedostupné.' })
  await page.goto('/')
  await signIn(page)
  await openCategories(page)

  await expect(page.getByText('Kategorie se nepodařilo načíst', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zkusit znovu' }).click()

  await expect(page.getByText('Bez kategorií', { exact: true })).toBeVisible()
})

test('switches directions and saves the reordered active category list', async ({ page }) => {
  const categories: CategoryFixture[] = [
    category('expense-1', 'Domov', 'expense', 0),
    category('income-1', 'Výplata', 'income', 0),
    category('income-2', 'Prodej', 'income', 1),
  ]

  await mockAuthAndApi(page)
  const categoryApi = await mockCategoriesApi(page, categories)
  await page.goto('/')
  await signIn(page)
  await openCategories(page)

  await expect(page.getByRole('listitem').filter({ hasText: 'Domov' })).toBeVisible()
  await page.getByRole('tab', { name: 'Příjmy' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Výplata' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Domov' })).not.toBeVisible()

  const source = page.getByRole('button', { name: 'Změnit pořadí kategorie Výplata' })
  const target = page.getByRole('button', { name: 'Změnit pořadí kategorie Prodej' })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Drag handle kategorie není viditelný.')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 12, { steps: 4 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(page.getByRole('listitem').first()).toContainText('Prodej')
  await expect.poll(() => categoryApi.categories('income').map((category) => category.id)).toEqual(['income-2', 'income-1'])
  await expect(categoryApi.categories('expense').map((category) => category.id)).toEqual(['expense-1'])
})

async function openCategories(page: Parameters<typeof mockAuthAndApi>[0]) {
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('button', { name: /Kategorie/ }).click()
}

function category(id: string, name: string, direction: CategoryFixture['direction'], sortOrder: number): CategoryFixture {
  return { id, name, direction, iconKey: 'tags', colorKey: 'teal', sortOrder }
}
