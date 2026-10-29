import { expect, test } from '@playwright/test'
import { mockAuthAndApi, signIn } from '../support/auth'
import { mockIndependenceApi } from '../support/independence'
import { mockWalletsApi } from '../support/wallets'

test('shows an empty state pointing at settings before independence has ever been configured', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page)
  await mockIndependenceApi(page)
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Nezávislost', exact: true }).click()
  await expect(page.getByText('Nezávislost ještě není nastavená', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Nastavit nezávislost' }).click()
  await expect(page.getByRole('heading', { name: 'Nezávislost', exact: true })).toBeVisible()
  await expect(page.getByLabel('Výběrová sazba (%)')).toBeVisible()
})

test('shows total and available progress as two distinct figures against the same target', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page)
  await mockIndependenceApi(page, {
    settings: {
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
    },
    progress: {
      hasSettings: true,
      annualExpensesCzk: 452_000,
      independenceNumberCzk: 11_300_000,
      totalWealthCzk: 2_000_000,
      availableWealthCzk: 1_500_000,
      totalProgressPercent: (2_000_000 / 11_300_000) * 100,
      availableProgressPercent: (1_500_000 / 11_300_000) * 100,
      yearsToTotal: 12.4,
      yearsToAvailable: 14.1,
      futureAnnualExpensesCzk: 630_000,
      wealthByType: [
        { walletType: 'investment', amountCzk: 1_500_000 },
        { walletType: 'crypto', amountCzk: 500_000 },
      ],
      returnSensitivity: [
        { realReturnPercent: 4, yearsToTotal: 12.4, yearsToAvailable: 14.1 },
        { realReturnPercent: 6, yearsToTotal: 10.2, yearsToAvailable: 11.5 },
        { realReturnPercent: 8, yearsToTotal: 8.7, yearsToAvailable: 9.8 },
      ],
    },
  })
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Nezávislost', exact: true }).click()

  await expect(page.getByText('11 300 000 Kč', { exact: true })).toBeVisible()
  await expect(page.getByText('Investice', { exact: true })).toBeVisible()
  await expect(page.getByText('Kryptoměny', { exact: true })).toBeVisible()
  const ownRateItem = page.locator('.independence-sensitivity__item--own')
  await expect(ownRateItem).toContainText('4 %')
  await expect(ownRateItem).toContainText('12,4 roku')
  const totalCard = page.locator('.independence-progress-card').filter({ hasText: 'Celkem' })
  const availableCard = page.locator('.independence-progress-card').filter({ hasText: 'Dostupné' })
  await expect(totalCard).toContainText('2 000 000 Kč')
  await expect(totalCard).toContainText('17,7')
  await expect(totalCard).toContainText('12,4 roku')
  await expect(availableCard).toContainText('1 500 000 Kč')
  await expect(availableCard).toContainText('13,3')
  await expect(availableCard).toContainText('14,1 roku')
})

test('shows a wealth trend chart with a tooltip on the last point', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page)
  await mockIndependenceApi(page, {
    settings: {
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
    },
    progress: {
      hasSettings: true,
      annualExpensesCzk: 452_000,
      independenceNumberCzk: 11_300_000,
      totalWealthCzk: 2_000_000,
      availableWealthCzk: 1_500_000,
      totalProgressPercent: 17.7,
      availableProgressPercent: 13.3,
      yearsToTotal: 12.4,
      yearsToAvailable: 14.1,
      futureAnnualExpensesCzk: 630_000,
      wealthByType: [],
      returnSensitivity: [],
    },
    wealthSeries: [
      { date: '2025-09-01', amountCzk: 1_600_000 },
      { date: '2025-10-01', amountCzk: 1_700_000 },
      { date: '2025-11-01', amountCzk: 1_850_000 },
      { date: '2025-12-01', amountCzk: 2_000_000 },
    ],
  })
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Nezávislost', exact: true }).click()

  const chart = page.locator('.independence-wealth-trend__chart')
  await expect(chart).toBeVisible()
  await expect(chart).toContainText('2 000 000 Kč')
  await expect(page.getByText('prosinec 2025', { exact: true })).toBeVisible()

  const lastPoint = page.getByRole('button', { name: /prosinec 2025: 2\s?000\s?000 Kč/ })
  await lastPoint.focus()
  await expect(page.locator('.independence-wealth-trend__tooltip')).toContainText('2 000 000 Kč')
})

test('opens independence settings from the header gear icon once already configured', async ({ page }) => {
  await mockAuthAndApi(page)
  await mockWalletsApi(page)
  await mockIndependenceApi(page, {
    settings: {
      withdrawalRatePercent: 4,
      expectedRealReturnPercent: 4,
      inflationRatePercent: 2.5,
      monthlyContributionCzk: 0,
      housingMonthlyCzk: 15_000,
      foodMonthlyCzk: 8_000,
      transportMonthlyCzk: 2_000,
      healthMonthlyCzk: 1_500,
      leisureMonthlyCzk: 4_000,
      clothingMonthlyCzk: 1_000,
      familyMonthlyCzk: 0,
      reserveMonthlyCzk: 2_000,
    },
    progress: {
      hasSettings: true,
      annualExpensesCzk: 402_000,
      independenceNumberCzk: 10_050_000,
      totalWealthCzk: 0,
      availableWealthCzk: 0,
      totalProgressPercent: 0,
      availableProgressPercent: 0,
      yearsToTotal: null,
      yearsToAvailable: null,
      futureAnnualExpensesCzk: null,
      wealthByType: [],
      returnSensitivity: [],
    },
  })
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Nezávislost', exact: true }).click()
  await expect(page.getByText('bez projekce')).toHaveCount(2)
  await page.getByRole('button', { name: 'Nastavení nezávislosti' }).click()
  await expect(page.getByLabel('Výběrová sazba (%)')).toBeVisible()

  await page.getByRole('button', { name: 'Zpět na nezávislost' }).click()
  await expect(page.getByRole('heading', { name: 'Nezávislost', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nastavení nezávislosti' })).toBeVisible()
})

const calculatorSettings = {
  withdrawalRatePercent: 4, expectedRealReturnPercent: 4, inflationRatePercent: 2.5, monthlyContributionCzk: 5_000,
  housingMonthlyCzk: 15_000, foodMonthlyCzk: 8_000, transportMonthlyCzk: 2_000, healthMonthlyCzk: 1_500,
  leisureMonthlyCzk: 4_000, clothingMonthlyCzk: 1_000, familyMonthlyCzk: 0, reserveMonthlyCzk: 2_000,
}

const calculatorProgress = {
  hasSettings: true, annualExpensesCzk: 452_000, independenceNumberCzk: 11_300_000, totalWealthCzk: 2_000_000, availableWealthCzk: 1_500_000,
  totalProgressPercent: (2_000_000 / 11_300_000) * 100, availableProgressPercent: (1_500_000 / 11_300_000) * 100,
  yearsToTotal: 12.4, yearsToAvailable: 14.1, futureAnnualExpensesCzk: 630_000,
  wealthByType: [{ walletType: 'investment' as const, amountCzk: 2_000_000 }],
  returnSensitivity: [{ realReturnPercent: 4, yearsToTotal: 12.4, yearsToAvailable: 14.1 }],
}

async function openCalculator(page: Parameters<typeof mockAuthAndApi>[0], tab: 'Kalkulačka' | 'Coast FIRE') {
  await mockAuthAndApi(page)
  await mockWalletsApi(page)
  await mockIndependenceApi(page, { settings: calculatorSettings, progress: calculatorProgress })
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Nezávislost', exact: true }).click()
  await page.getByRole('tab', { name: tab }).click()
}

test('the what-if calculator only objects to what is not a number or what the maths cannot take', async ({ page }) => {
  await openCalculator(page, 'Kalkulačka')
  const returnField = page.getByLabel('Očekávaný reálný výnos (%)')
  const returnError = 'Zadej číslo větší než −100 a nejvýše 10 000.'

  // The old 20 % ceiling is gone: a return of 25 % is a perfectly good scenario.
  await returnField.fill('25')
  await expect(returnField).toHaveValue('25')
  await expect(page.getByText(returnError, { exact: true })).toHaveCount(0)

  await returnField.fill('abc')
  await expect(page.getByText(returnError, { exact: true })).toBeVisible()
  await returnField.fill('-150')
  await expect(page.getByText(returnError, { exact: true })).toBeVisible()
  await returnField.fill('')
  await expect(page.getByText(returnError, { exact: true })).toHaveCount(0)

  const rateField = page.getByLabel('Výběrová sazba (%)')
  await rateField.fill('0')
  await expect(page.getByText('Zadej číslo větší než 0 a nejvýše 10 000.', { exact: true })).toBeVisible()
  await rateField.fill('0,5')
  await expect(page.getByText('Zadej číslo větší než 0 a nejvýše 10 000.', { exact: true })).toHaveCount(0)

  await page.getByLabel('Pauza spoření (měsíců)').fill('x')
  await expect(page.getByText('Zadej celý počet měsíců.', { exact: true }).first()).toBeVisible()
  await page.getByLabel('Měsíční vklad').fill('12.5')
  await expect(page.getByText('Zadej celé koruny.', { exact: true })).toBeVisible()
})

test('the Coast FIRE calculator explains a horizon that is not a whole number of years', async ({ page }) => {
  await openCalculator(page, 'Coast FIRE')
  const horizon = page.getByLabel('Chci být nezávislý nejpozději za (let)')

  await horizon.fill('0')
  await expect(page.getByText('Zadej celý počet let větší než nula.', { exact: true })).toBeVisible()
  await horizon.fill('abc')
  await expect(page.getByText('Zadej celý počet let větší než nula.', { exact: true })).toBeVisible()
  await horizon.fill('45')
  await expect(page.getByText('Zadej celý počet let větší než nula.', { exact: true })).toHaveCount(0)

  await page.getByLabel('Očekávaný reálný výnos (%)').fill('25')
  await expect(page.getByText('Zadej číslo větší než −100 a nejvýše 10 000.', { exact: true })).toHaveCount(0)
})
