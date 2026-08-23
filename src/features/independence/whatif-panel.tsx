import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Field, FieldDescription, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { Switch } from '../../components/ui/switch'
import { formatCzk } from '../../lib/format-czk'
import type { IndependenceSettings } from './api'
import { computeScenario, resolveScenarioTargetCzk, type ScenarioPoint } from './projection'

type WhatIfPanelProps = {
  totalWealthCzk: number
  independenceNumberCzk: number
  annualIrregularCzk: number
  settings: IndependenceSettings
}

type FormValues = {
  monthlyContributionCzk: string
  pauseMonths: string
  lumpSumCzk: string
  lumpSumMonth: string
  realReturnPercent: string
  withdrawalRatePercent: string
  expensesDeltaPercent: string
  customTargetCzk: string
}

function defaultValues(settings: IndependenceSettings): FormValues {
  return {
    monthlyContributionCzk: String(settings.monthlyContributionCzk),
    pauseMonths: '',
    lumpSumCzk: '',
    lumpSumMonth: '',
    realReturnPercent: String(settings.expectedRealReturnPercent),
    withdrawalRatePercent: String(settings.withdrawalRatePercent),
    expensesDeltaPercent: '',
    customTargetCzk: '',
  }
}

export function WhatIfPanel({ totalWealthCzk, independenceNumberCzk, annualIrregularCzk, settings }: WhatIfPanelProps) {
  const [values, setValues] = useState<FormValues>(() => defaultValues(settings))
  const [excludeIrregular, setExcludeIrregular] = useState(false)

  function setValue(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const monthlyContributionCzk = parseNonNegativeCzk(values.monthlyContributionCzk) ?? settings.monthlyContributionCzk
  const pauseMonths = parseNonNegativeInteger(values.pauseMonths) ?? 0
  const lumpSumCzk = parseSignedCzk(values.lumpSumCzk) ?? 0
  const lumpSumMonth = parseNonNegativeInteger(values.lumpSumMonth) ?? 0
  const realReturnPercent = parsePercent(values.realReturnPercent, -10, 20) ?? settings.expectedRealReturnPercent
  const withdrawalRatePercent = parsePercent(values.withdrawalRatePercent, 0.01, 20) ?? settings.withdrawalRatePercent
  const expensesDeltaPercent = parseSignedPercent(values.expensesDeltaPercent, -50, 100) ?? 0
  const customTargetCzk = values.customTargetCzk.trim() === '' ? null : parseNonNegativeCzk(values.customTargetCzk)
  const hasCustomTarget = customTargetCzk !== null && customTargetCzk > 0

  const baseline = useMemo(() => computeScenario({
    startWealthCzk: totalWealthCzk,
    targetCzk: independenceNumberCzk,
    realReturnPercent: settings.expectedRealReturnPercent,
    monthlyContributionCzk: settings.monthlyContributionCzk,
    pauseMonths: 0,
    lumpSumCzk: 0,
    lumpSumMonth: 0,
  }), [totalWealthCzk, independenceNumberCzk, settings.expectedRealReturnPercent, settings.monthlyContributionCzk])

  const scenarioTargetCzk = hasCustomTarget ? customTargetCzk : resolveScenarioTargetCzk({
    independenceNumberCzk,
    baseWithdrawalRatePercent: settings.withdrawalRatePercent,
    withdrawalRatePercent,
    annualIrregularCzk,
    excludeIrregularExpenses: excludeIrregular,
    expensesDeltaPercent,
  })
  const scenario = useMemo(() => computeScenario({
    startWealthCzk: totalWealthCzk,
    targetCzk: scenarioTargetCzk,
    realReturnPercent,
    monthlyContributionCzk,
    pauseMonths,
    lumpSumCzk,
    lumpSumMonth,
  }), [totalWealthCzk, scenarioTargetCzk, realReturnPercent, monthlyContributionCzk, pauseMonths, lumpSumCzk, lumpSumMonth])

  const horizonYears = Math.min(60, Math.max(5, (Math.max(baseline.yearsToTarget ?? 40, scenario.yearsToTarget ?? 40)) * 1.15))

  return (
    <Card padding="sm" className="independence-whatif" render={<section aria-label="Kalkulačka nezávislosti" />}>
      <CardContent className="independence-whatif__body">
        <div className="independence-whatif__summary">
          <div className="independence-whatif__summary-item">
            <span>Beze změny</span>
            <strong>{formatYearsToTarget(baseline.yearsToTarget)}</strong>
            <em>cíl {formatCzk(independenceNumberCzk)}</em>
          </div>
          <div className="independence-whatif__summary-item independence-whatif__summary-item--scenario">
            <span>Se scénářem</span>
            <strong>{formatYearsToTarget(scenario.yearsToTarget)}</strong>
            <em>cíl {formatCzk(scenarioTargetCzk)}</em>
          </div>
          <div className="independence-whatif__summary-item independence-whatif__summary-item--delta">
            <span>Rozdíl</span>
            <strong className={deltaTone(baseline.yearsToTarget, scenario.yearsToTarget)}>{formatDelta(baseline.yearsToTarget, scenario.yearsToTarget)}</strong>
          </div>
        </div>

        <ScenarioChart baseline={baseline.points} scenario={scenario.points} baselineTargetCzk={independenceNumberCzk} scenarioTargetCzk={scenarioTargetCzk} horizonYears={horizonYears} />

        <form className="independence-whatif__form" onSubmit={(event) => event.preventDefault()} noValidate>
          <Field>
            <FieldLabel>Měsíční vklad</FieldLabel>
            <Input type="text" inputMode="numeric" value={values.monthlyContributionCzk} onChange={(event) => setValue('monthlyContributionCzk', event.currentTarget.value)} />
          </Field>
          <Field>
            <FieldLabel>Pauza spoření (měsíců)</FieldLabel>
            <Input type="text" inputMode="numeric" placeholder="0" value={values.pauseMonths} onChange={(event) => setValue('pauseMonths', event.currentTarget.value)} />
            <FieldDescription>Po tuto dobu od teď se neukládá žádný měsíční vklad, pak pokračuje normálně.</FieldDescription>
          </Field>
          <div className="independence-whatif__group">
            <span className="independence-whatif__group-label">Jednorázová částka</span>
            <div className="independence-whatif__group-row">
              <Field>
                <FieldLabel>Kolik</FieldLabel>
                <Input type="text" inputMode="numeric" placeholder="0" value={values.lumpSumCzk} onChange={(event) => setValue('lumpSumCzk', event.currentTarget.value)} />
              </Field>
              <Field>
                <FieldLabel>Za kolik měsíců</FieldLabel>
                <Input type="text" inputMode="numeric" placeholder="0" value={values.lumpSumMonth} onChange={(event) => setValue('lumpSumMonth', event.currentTarget.value)} disabled={lumpSumCzk === 0} />
              </Field>
            </div>
            <p className="independence-whatif__group-hint">Kladná = vklad (např. dědictví), záporná = výběr (např. koupě auta). Netýká se pauzy ani měsíčního vkladu.</p>
          </div>
          <Field>
            <FieldLabel>Očekávaný reálný výnos (%)</FieldLabel>
            <Input type="text" inputMode="decimal" value={values.realReturnPercent} onChange={(event) => setValue('realReturnPercent', event.currentTarget.value)} />
          </Field>
          <div className="independence-whatif__group">
            <span className="independence-whatif__group-label">Cílová částka</span>
            <Field>
              <FieldLabel>Vlastní cíl (nepovinné)</FieldLabel>
              <Input type="text" inputMode="numeric" placeholder={new Intl.NumberFormat('cs-CZ').format(independenceNumberCzk)} value={values.customTargetCzk} onChange={(event) => setValue('customTargetCzk', event.currentTarget.value)} />
            </Field>
            <p className="independence-whatif__group-hint">{hasCustomTarget ? 'Přepisuje cíl spočítaný z výběrové sazby a nákladů níže — ta pole teď nemají vliv.' : `Necháš-li prázdné, cíl se dopočítá z výběrové sazby a nákladů níže (teď ${formatCzk(independenceNumberCzk)}).`}</p>
          </div>
          <Field>
            <FieldLabel>Výběrová sazba (%)</FieldLabel>
            <Input type="text" inputMode="decimal" value={values.withdrawalRatePercent} onChange={(event) => setValue('withdrawalRatePercent', event.currentTarget.value)} disabled={hasCustomTarget} />
            <FieldDescription>Nižší sazba = konzervativnější odhad = vyšší cílová částka. Přímo mění cíl, ne jen rychlost růstu.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Změna ročních nákladů (%)</FieldLabel>
            <Input type="text" inputMode="decimal" placeholder="0" value={values.expensesDeltaPercent} onChange={(event) => setValue('expensesDeltaPercent', event.currentTarget.value)} disabled={hasCustomTarget} />
            <FieldDescription>Kladné číslo = vyšší náklady, se znaménkem „-" nižší. Cílová částka {formatCzk(independenceNumberCzk)} se přepočítá na {formatCzk(scenarioTargetCzk)}.</FieldDescription>
          </Field>
          {annualIrregularCzk > 0 ? (
            <div className="independence-whatif__group">
              <div className="independence-whatif__switch-row">
                <span className="independence-whatif__group-label">Zahrnout nepravidelné výdaje</span>
                <Switch checked={!excludeIrregular} onCheckedChange={(checked) => setExcludeIrregular(!checked)} disabled={hasCustomTarget} />
              </div>
              <p className="independence-whatif__group-hint">Vypnuto = vyloučí {formatCzk(Math.round(annualIrregularCzk))} ročně z nepravidelných výdajů z cílové částky pro tenhle scénář.</p>
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={() => { setValues(defaultValues(settings)); setExcludeIrregular(false) }}>Vrátit na aktuální nastavení</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ScenarioChart({ baseline, scenario, baselineTargetCzk, scenarioTargetCzk, horizonYears }: { baseline: ScenarioPoint[]; scenario: ScenarioPoint[]; baselineTargetCzk: number; scenarioTargetCzk: number; horizonYears: number }) {
  const visibleBaseline = baseline.filter((point) => point.years <= horizonYears)
  const visibleScenario = scenario.filter((point) => point.years <= horizonYears)
  const targetsDiffer = Math.abs(scenarioTargetCzk - baselineTargetCzk) >= 1
  const amounts = [...visibleBaseline, ...visibleScenario].map((point) => point.amountCzk).concat(baselineTargetCzk, scenarioTargetCzk)
  const min = Math.min(...amounts, 0)
  const max = Math.max(...amounts, 1)
  const span = max - min || 1
  const toPoint = (point: ScenarioPoint) => `${(point.years / horizonYears) * 300},${132 - ((point.amountCzk - min) / span) * 100}`
  const toTargetY = (targetCzk: number) => 132 - ((targetCzk - min) / span) * 100

  return (
    <div className="independence-whatif__chart">
      <div className="independence-whatif__chart-legend">
        <span className="independence-whatif__chart-legend-item independence-whatif__chart-legend-item--baseline">Beze změny</span>
        <span className="independence-whatif__chart-legend-item independence-whatif__chart-legend-item--scenario">Se scénářem</span>
      </div>
      <div className="independence-whatif__chart-scale"><span>{formatCompactMoney(max)}</span><span>{formatCompactMoney(min)}</span></div>
      <svg viewBox="0 0 300 148" role="img" aria-label="Projekce bohatství: beze změny vs. se scénářem, do cílové částky">
        <line x1="0" x2="300" y1={toTargetY(baselineTargetCzk)} y2={toTargetY(baselineTargetCzk)} className="independence-whatif__chart-target independence-whatif__chart-target--baseline" />
        {targetsDiffer ? <line x1="0" x2="300" y1={toTargetY(scenarioTargetCzk)} y2={toTargetY(scenarioTargetCzk)} className="independence-whatif__chart-target independence-whatif__chart-target--scenario" /> : null}
        {/* Scenario drawn first so the dashed baseline renders on top and stays visible even
            when the two trajectories nearly coincide (e.g. only the target changed). */}
        <polyline points={visibleScenario.map(toPoint).join(' ')} className="independence-whatif__chart-scenario" />
        <polyline points={visibleBaseline.map(toPoint).join(' ')} className="independence-whatif__chart-baseline" />
      </svg>
      <div className="independence-whatif__chart-dates"><span>dnes</span><span>za {formatYearsShort(horizonYears)}</span></div>
    </div>
  )
}

function deltaTone(baselineYears: number | null, scenarioYears: number | null) {
  if (baselineYears === null || scenarioYears === null) return ''
  return scenarioYears <= baselineYears ? 'is-positive' : 'is-negative'
}

function formatDelta(baselineYears: number | null, scenarioYears: number | null) {
  if (baselineYears === null || scenarioYears === null) return '—'
  const deltaYears = scenarioYears - baselineYears
  if (Math.abs(deltaYears) < 0.05) return 'beze změny'
  const sign = deltaYears > 0 ? '+' : '−'
  return `${sign}${formatYearsShort(Math.abs(deltaYears))}`
}

function formatYearsToTarget(years: number | null) {
  if (years === null) return 'bez projekce'
  if (years === 0) return 'už teď'
  return `za ${formatYearsShort(years)}`
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', { notation: 'compact', maximumFractionDigits: 1 }).format(value) + ' Kč'
}

function formatYearsShort(years: number) {
  if (years < 1) return `${Math.round(years * 12)} měsíců`
  const whole = Math.round(years * 10) / 10
  return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(whole)} let`
}

function parseNonNegativeCzk(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (normalized === '') return 0
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

function parseSignedCzk(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (normalized === '' || normalized === '-') return 0
  if (!/^-?\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

function parseNonNegativeInteger(value: string) {
  const normalized = value.trim()
  if (normalized === '') return 0
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

function parsePercent(value: string, min: number, max: number) {
  const normalized = value.replace(',', '.').trim()
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  const amount = Number(normalized)
  return amount >= min && amount <= max ? amount : null
}

function parseSignedPercent(value: string, min: number, max: number) {
  const normalized = value.replace(',', '.').trim()
  if (normalized === '' || normalized === '-') return 0
  return parsePercent(normalized, min, max)
}
