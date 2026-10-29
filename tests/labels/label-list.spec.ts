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

test('says so when the next page of labels cannot be loaded, and loads it on the next try', async ({ page }) => {
  const labels = [label('1', 'zara'), ...Array.from({ length: 50 }, (_, index) => label(`many-${index}`, `label-${String(index).padStart(2, '0')}`))]
  await mockAuthAndApi(page)
  const labelApi = await mockLabelsApi(page, labels)
  await page.goto('/')
  await signIn(page)
  await openLabels(page)
  await expect(page.getByRole('button', { name: 'Načíst další' })).toBeVisible()

  labelApi.failNext('GET', { message: 'Dočasně nedostupné.' })
  await page.getByRole('button', { name: 'Načíst další' }).click()
  await expect(page.getByText('Další štítky se nepodařilo načíst', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Načíst další' })).toBeVisible()

  await page.getByRole('button', { name: 'Načíst další' }).click()
  await expect(page.getByRole('button', { name: 'zara' })).toBeVisible()
  await expect(page.getByText('Další štítky se nepodařilo načíst', { exact: true })).not.toBeVisible()
})

test('a next page requested for one search never lands in the list of another', async ({ page }) => {
  const labels = [label('1', 'zara'), label('2', 'globus'), ...Array.from({ length: 49 }, (_, index) => label(`many-${index}`, `label-${String(index).padStart(2, '0')}`))]
  await mockAuthAndApi(page)
  await mockLabelsApi(page, labels)
  let secondPageRequested!: () => void
  const requested = new Promise<void>((resolve) => { secondPageRequested = resolve })
  let releaseSecondPage!: () => void
  const gate = new Promise<void>((resolve) => { releaseSecondPage = resolve })
  // Registered after the mock, so it sees the request first and hands it on once released.
  await page.route('http://api.test/api/labels**', async (route) => {
    if (!new URL(route.request().url()).searchParams.has('cursor')) return route.fallback()
    secondPageRequested()
    await gate
    await route.fallback().catch(() => {})
  })
  await page.goto('/')
  await signIn(page)
  await openLabels(page)
  await expect(page.getByRole('button', { name: 'Načíst další' })).toBeVisible()

  const staleRequestCancelled = page.waitForEvent('requestfailed', (request) => request.url().includes('cursor='))
  await page.getByRole('button', { name: 'Načíst další' }).click()
  await requested
  await page.getByLabel('Hledat štítky').fill('glob')
  await expect(page.getByRole('button', { name: 'globus' })).toBeVisible()
  // The app cancels the request for the old search instead of waiting for it.
  await staleRequestCancelled
  releaseSecondPage()

  await expect(page.getByRole('button', { name: 'zara' })).not.toBeVisible()
  await expect(page.locator('.labels-list').getByRole('button')).toHaveCount(1)
})

async function openLabels(page: Parameters<typeof mockAuthAndApi>[0]) {
  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('button', { name: /Štítky/ }).click()
}

function label(id: string, name: string): LabelFixture {
  return { id, name }
}
