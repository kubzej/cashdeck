import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockFeedApi } from '../support/feed'

test('browses months in both directions without loading the complete history', async ({ page }) => {
  await mockAuthAndApi(page)
  const feedApi = await mockFeedApi(page, [], { earliestActivityDate: '2020-01-01' })
  await page.goto('/')
  await signIn(page)

  await expect.poll(() => feedApi.requests().length).toBe(1)
  const currentMonth = feedApi.requests()[0]
  const title = page.locator('.feed-period-pager__title')
  const titleBeforeScroll = await title.textContent()
  const viewport = page.getByLabel('Obsah období')
  await expect(viewport).toBeVisible()

  const firstSwipe = await startSwipe(page, viewport, 'left')
  await expect(viewport).toHaveAttribute('data-preview', 'previous')
  await expect(page.locator('.feed-period-pager__preview')).toContainText('červenec 2026')
  await firstSwipe.release()
  await expect.poll(() => feedApi.requests().length).toBe(2)
  await expect(page.locator('.feed-period-pager__page')).toHaveAttribute('data-motion', 'from-right')
  const previousMonth = feedApi.requests()[1]
  expect(previousMonth.searchParams.get('dateFrom')).not.toBe(currentMonth.searchParams.get('dateFrom'))
  expect(previousMonth.searchParams.get('dateTo')! < currentMonth.searchParams.get('dateFrom')!).toBe(true)
  await expect(title).not.toHaveText(titleBeforeScroll ?? '')

  await swipePeriod(page, viewport, 'right')
  await expect.poll(() => feedApi.requests().length).toBe(3)
  await expect(page.locator('.feed-period-pager__page')).toHaveAttribute('data-motion', 'from-left')
  const currentMonthAgain = feedApi.requests()[2]
  expect(currentMonthAgain.searchParams.get('dateFrom')).toBe(currentMonth.searchParams.get('dateFrom'))
  await expect(title).toHaveText(titleBeforeScroll ?? '')

  await page.getByRole('button', { name: 'Filtrovat období: Po měsících' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Celá historie', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Použít filtr' }).click()
  await expect(viewport).toBeHidden()
})

async function swipePeriod(page: import('@playwright/test').Page, viewport: import('@playwright/test').Locator, direction: 'left' | 'right') {
  const swipe = await startSwipe(page, viewport, direction)
  await swipe.release()
}

async function startSwipe(page: import('@playwright/test').Page, viewport: import('@playwright/test').Locator, direction: 'left' | 'right') {
  const box = await viewport.boundingBox()
  if (!box) throw new Error('Period viewport is not visible')
  const startX = direction === 'left' ? box.x + box.width * 0.75 : box.x + box.width * 0.25
  const endX = direction === 'left' ? box.x + box.width * 0.25 : box.x + box.width * 0.75
  const y = box.y + Math.min(40, box.height / 2)
  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(endX, y, { steps: 8 })
  return { release: () => page.mouse.up() }
}
