import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockIndependenceApi } from '../support/independence'
import { mockWalletsApi, type WalletFixture } from '../support/wallets'

const wallet: WalletFixture = {
  id: 'wallet-1',
  name: 'Broker',
  colorKey: 'teal',
  openingBalanceCzk: 100_000,
  openingBalanceDate: '2024-01-01',
  sortOrder: 0,
  isHidden: false,
  openingBalanceLocked: false,
}

const savedSettings = {
  withdrawalRatePercent: 4,
  expectedRealReturnPercent: 4,
  inflationRatePercent: 2.5,
  monthlyContributionCzk: 5_000,
  housingMonthlyCzk: 15_000,
  foodMonthlyCzk: 8_000,
  transportMonthlyCzk: 2_000,
  healthMonthlyCzk: 1_500,
  leisureMonthlyCzk: 4_000,
  clothingMonthlyCzk: 1_000,
  familyMonthlyCzk: 0,
  reserveMonthlyCzk: 2_000,
}

test('hides the wallet independence flags until independence settings have been saved once, then shows them', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockIndependenceApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: 'Spravovat peněženku Broker' }).click()
  await expect(page.getByText('Počítá se do nezávislosti?', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Zpět na peněženky' }).click()

  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: 'Nastavení nezávislosti' }).click()
  await page.getByLabel('Výběrová sazba (%)').fill('4')
  await page.getByLabel('Očekávaný reálný výnos (%)').fill('4')
  await page.getByLabel('Míra inflace (%)').fill('2.5')
  await page.getByRole('button', { name: 'Uložit nastavení' }).click()
  await expect(page.getByText('Nastavení uloženo', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zpět do nastavení' }).click()

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: 'Spravovat peněženku Broker' }).click()
  await expect(page.getByText('Počítá se do nezávislosti?', { exact: true })).toBeVisible()
})

test('only allows "available now" once "counts toward independence" is on, in the wallet form', async ({ page }) => {
  await mockAuthAndApi(page)
  const walletApi = await mockWalletsApi(page, [wallet])
  await mockIndependenceApi(page, { settings: savedSettings })
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await page.getByRole('button', { name: 'Spravovat peněženku Broker' }).click()

  await expect(page.getByText('Dostupné hned?', { exact: true })).toHaveCount(0)
  await page.getByRole('group', { name: 'Počítá se do nezávislosti?' }).getByRole('button', { name: 'Ano' }).click()
  await expect(page.getByText('Dostupné hned?', { exact: true })).toBeVisible()
  await page.getByRole('group', { name: 'Dostupné hned?' }).getByRole('button', { name: 'Ano' }).click()

  await page.getByRole('button', { name: 'Uložit změny' }).click()

  await expect.poll(() => walletApi.lastRequestBody('PATCH')).toEqual(expect.objectContaining({ countsTowardIndependence: true, availableNow: true }))
})

test('starts category fields empty so typing a number never leaves a stray leading zero', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockIndependenceApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: 'Nastavení nezávislosti' }).click()

  const housing = page.getByLabel('Bydlení (měsíčně)')
  await expect(housing).toHaveValue('')
  await housing.pressSequentially('200')
  await expect(housing).toHaveValue('200')
})

test('backspacing a prefilled parameter value does not crash the page', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockIndependenceApi(page, { settings: savedSettings })
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: 'Nastavení nezávislosti' }).click()

  // Reproduces the reported crash: a field with a real prefilled value (not blank),
  // backspaced to empty and retyped — the onChange updater must not read a stale
  // SyntheticEvent's currentTarget after React re-invokes it.
  const rate = page.getByLabel('Výběrová sazba (%)')
  await expect(rate).toHaveValue('4')
  await rate.click()
  await rate.press('Backspace')
  await expect(rate).toHaveValue('')
  await rate.pressSequentially('3.5')
  await expect(rate).toHaveValue('3.5')

  expect(pageErrors).toEqual([])
})

test('shows an unconfigured/configured indicator on the Nastavení row', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  await mockIndependenceApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await expect(page.getByText('Zatím nenastaveno', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Nastavení nezávislosti' }).click()
  await page.getByLabel('Výběrová sazba (%)').fill('4')
  await page.getByLabel('Očekávaný reálný výnos (%)').fill('4')
  await page.getByLabel('Míra inflace (%)').fill('2.5')
  await page.getByRole('button', { name: 'Uložit nastavení' }).click()
  await expect(page.getByText('Nastavení uloženo', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zpět do nastavení' }).click()

  await expect(page.getByText('Nastaveno', { exact: true })).toBeVisible()
  await expect(page.getByText('Zatím nenastaveno', { exact: true })).toHaveCount(0)
})

test('adds, edits, and deletes an irregular expense', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page, [wallet])
  const independenceApi = await mockIndependenceApi(page, { settings: savedSettings })
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Nastavení', exact: true }).click()
  await page.getByRole('button', { name: 'Nastavení nezávislosti' }).click()

  await page.getByRole('button', { name: 'Přidat nepravidelný výdaj' }).click()
  await page.getByLabel('Název').fill('Výměna auta')
  await page.getByLabel('Částka').fill('400000')
  await page.getByLabel('Frekvence (roky)').fill('8')
  await page.getByRole('button', { name: 'Přidat', exact: true }).click()

  await expect(page.getByText('Výměna auta', { exact: true })).toBeVisible()
  await expect(page.getByText(/ročně 50\s?000 Kč/)).toBeVisible()
  expect(independenceApi.irregularExpenses()).toHaveLength(1)

  await page.getByRole('button', { name: 'Upravit Výměna auta' }).click()
  await page.getByLabel('Částka').fill('480000')
  await page.getByRole('button', { name: 'Uložit', exact: true }).click()
  await expect(page.getByText(/ročně 60\s?000 Kč/)).toBeVisible()

  await page.getByRole('button', { name: 'Smazat Výměna auta' }).click()
  await expect(page.getByText('Výměna auta', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Zatím žádné nepravidelné výdaje.', { exact: true })).toBeVisible()
})
