import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockCategoriesApi, type CategoryFixture } from '../support/categories'

test('validates required category data and retries a failed creation', async ({ page }) => {
  await mockAuthAndApi(page)
  const categoryApi = await mockCategoriesApi(page)
  await page.goto('/')
  await signIn(page)
  await openCategories(page)

  await page.getByRole('button', { name: 'Přidat výdajovou kategorii' }).click()
  await page.getByRole('button', { name: 'Uložit kategorii' }).click()
  await expect(page.getByText('Zadej název kategorie.', { exact: true })).toBeVisible()

  await page.getByLabel('Název').fill('Volný čas')
  await page.getByLabel('Jídlo').click()
  await page.getByLabel('Tmavě hnědá').click()
  categoryApi.failNext('POST', { message: 'Uložení je dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Uložit kategorii' }).click()
  await expect(page.getByText('Kategorii se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit kategorii' }).click()
  await expect.poll(() => categoryApi.categories()).toEqual([
    expect.objectContaining({ name: 'Volný čas', direction: 'expense', iconKey: 'pizza', colorKey: 'brown-dark' }),
  ])
  await expect(page.getByRole('listitem').filter({ hasText: 'Volný čas' })).toBeVisible()
})

test('edits the category name, icon, and color without exposing its locked direction', async ({ page }) => {
  const category: CategoryFixture = { id: 'category-1', name: 'Domov', direction: 'expense', iconKey: 'house', colorKey: 'teal', sortOrder: 0 }
  await mockAuthAndApi(page)
  const categoryApi = await mockCategoriesApi(page, [category])
  await page.goto('/')
  await signIn(page)
  await openCategories(page)

  await page.getByRole('listitem').filter({ hasText: 'Domov' }).click()
  await expect(page.getByRole('heading', { name: 'Upravit kategorii' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)

  await page.getByLabel('Název').fill('Bydlení')
  await page.getByLabel('Investice').click()
  await page.getByRole('button', { name: 'Hnědá', exact: true }).click()
  categoryApi.failNext('PATCH', { message: 'Změny se nepodařilo uložit.' })
  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect(page.getByText('Kategorii se nepodařilo uložit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Uložit změny' }).click()
  await expect.poll(() => categoryApi.categories()[0]).toMatchObject({
    name: 'Bydlení', direction: 'expense', iconKey: 'chart-no-axes-combined', colorKey: 'brown',
  })
})

test('rejects a category name that already exists in the same direction, case-insensitively', async ({ page }) => {
  const category: CategoryFixture = { id: 'category-1', name: 'Domov', direction: 'expense', iconKey: 'house', colorKey: 'teal', sortOrder: 0 }
  await mockAuthAndApi(page)
  const categoryApi = await mockCategoriesApi(page, [category])
  await page.goto('/')
  await signIn(page)
  await openCategories(page)

  await page.getByRole('button', { name: 'Přidat výdajovou kategorii' }).click()
  await page.getByLabel('Název').fill('domov')
  await page.getByRole('button', { name: 'Uložit kategorii' }).click()
  await expect(page.getByText('Kategorie s tímto názvem už existuje.', { exact: true })).toBeVisible()
  expect(categoryApi.categories()).toHaveLength(1)
})

async function openCategories(page: Parameters<typeof mockAuthAndApi>[0]) {
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('button', { name: /Kategorie/ }).click()
}
