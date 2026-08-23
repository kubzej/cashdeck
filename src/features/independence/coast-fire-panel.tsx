import { useMemo, useState, type CSSProperties } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Field, FieldDescription, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { formatCzk } from '../../lib/format-czk'
import type { IndependenceSettings } from './api'
import { computeCoastFire } from './projection'

type CoastFirePanelProps = {
  totalWealthCzk: number
  independenceNumberCzk: number
  settings: IndependenceSettings
  defaultHorizonYears: number
}

type FormValues = {
  horizonYears: string
  realReturnPercent: string
  monthlyContributionCzk: string
  customTargetCzk: string
}

function defaultValues(settings: IndependenceSettings, defaultHorizonYears: number): FormValues {
  return {
    horizonYears: String(defaultHorizonYears),
    realReturnPercent: String(settings.expectedRealReturnPercent),
    monthlyContributionCzk: String(settings.monthlyContributionCzk),
    customTargetCzk: '',
  }
}

export function CoastFirePanel({ totalWealthCzk, independenceNumberCzk, settings, defaultHorizonYears }: CoastFirePanelProps) {
  const [values, setValues] = useState<FormValues>(() => defaultValues(settings, defaultHorizonYears))

  function setValue(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const horizonYears = parsePositiveInteger(values.horizonYears) ?? defaultHorizonYears
  const realReturnPercent = parsePercent(values.realReturnPercent, -10, 20) ?? settings.expectedRealReturnPercent
  const monthlyContributionCzk = parseNonNegativeCzk(values.monthlyContributionCzk) ?? settings.monthlyContributionCzk
  const customTargetCzk = values.customTargetCzk.trim() === '' ? null : parseNonNegativeCzk(values.customTargetCzk)
  const hasCustomTarget = customTargetCzk !== null && customTargetCzk > 0
  const targetCzk = hasCustomTarget ? customTargetCzk : independenceNumberCzk

  const result = useMemo(() => computeCoastFire({
    startWealthCzk: totalWealthCzk,
    targetCzk,
    realReturnPercent,
    monthlyContributionCzk,
    horizonYears,
  }), [totalWealthCzk, targetCzk, realReturnPercent, monthlyContributionCzk, horizonYears])

  const progressPercent = result.coastNumberTodayCzk > 0 ? Math.min(100, (totalWealthCzk / result.coastNumberTodayCzk) * 100) : 100

  return (
    <Card padding="sm" className="independence-coast" render={<section aria-label="Coast FIRE" />}>
      <CardContent className="independence-coast__body">
        <div className="independence-coast__stat">
          <span className="independence-coast__stat-label">Coast FIRE číslo dnes</span>
          <strong className="independence-coast__stat-amount">{formatCzk(Math.round(result.coastNumberTodayCzk))}</strong>
          <div className="independence-coast__bar"><i style={{ '--independence-coast-bar-size': `${progressPercent}%` } as CSSProperties} /></div>
          <span className="independence-coast__stat-caption">máš {formatCzk(totalWealthCzk)} ({formatPercent(progressPercent)})</span>
        </div>

        <p className="independence-coast__result">
          {result.isCoastingAlready
            ? `Už jsi na Coast FIRE! I kdybys dnes úplně přestal spořit, za ${horizonYears} ${yearsWord(horizonYears)} bys díky růstu investic dosáhl cíle sám.`
            : result.yearsToCoast !== null
              ? `Coast FIRE dosáhneš za ${formatYearsShort(result.yearsToCoast)} (kolem roku ${targetYear(result.yearsToCoast)}), kdy budeš mít ${formatCzk(Math.round(result.coastDateWealthCzk ?? 0))}. Od tohodle bodu bys mohl přestat spořit a pořád bys stihl cíl do ${horizonYears} ${yearsWord(horizonYears)}.`
              : `Při současném měsíčním vkladu (${formatCzk(monthlyContributionCzk)}) a horizontu ${horizonYears} ${yearsWord(horizonYears)} se do Coast FIRE nedostaneš — zkus horizont prodloužit nebo vklad zvýšit.`}
        </p>

        <form className="independence-coast__form" onSubmit={(event) => event.preventDefault()} noValidate>
          <Field>
            <FieldLabel>Chci být nezávislý nejpozději za (let)</FieldLabel>
            <Input type="text" inputMode="numeric" value={values.horizonYears} onChange={(event) => setValue('horizonYears', event.currentTarget.value)} />
            <FieldDescription>I kdybys od nějakého bodu přestal úplně spořit, chceš mít cílovou částku nejpozději za tolik let.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Očekávaný reálný výnos (%)</FieldLabel>
            <Input type="text" inputMode="decimal" value={values.realReturnPercent} onChange={(event) => setValue('realReturnPercent', event.currentTarget.value)} />
          </Field>
          <Field>
            <FieldLabel>Měsíční vklad</FieldLabel>
            <Input type="text" inputMode="numeric" value={values.monthlyContributionCzk} onChange={(event) => setValue('monthlyContributionCzk', event.currentTarget.value)} />
            <FieldDescription>Kolik do bodu Coast FIRE ještě plánuješ měsíčně přidávat.</FieldDescription>
          </Field>
          <div className="independence-coast__group">
            <span className="independence-coast__group-label">Cílová částka</span>
            <Field>
              <FieldLabel>Vlastní cíl (nepovinné)</FieldLabel>
              <Input type="text" inputMode="numeric" placeholder={new Intl.NumberFormat('cs-CZ').format(independenceNumberCzk)} value={values.customTargetCzk} onChange={(event) => setValue('customTargetCzk', event.currentTarget.value)} />
            </Field>
            <p className="independence-coast__group-hint">{hasCustomTarget ? 'Přepisuje tvůj skutečný cíl nezávislosti.' : `Necháš-li prázdné, počítá se s tvým skutečným cílem (${formatCzk(independenceNumberCzk)}).`}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setValues(defaultValues(settings, defaultHorizonYears))}>Vrátit na aktuální nastavení</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(value)} %`
}

function formatYearsShort(years: number) {
  if (years < 1) return `${Math.round(years * 12)} měsíců`
  const whole = Math.round(years * 10) / 10
  return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(whole)} let`
}

function yearsWord(years: number) {
  return years === 1 ? 'rok' : years >= 2 && years <= 4 ? 'roky' : 'let'
}

function targetYear(years: number) {
  return new Date().getFullYear() + Math.round(years)
}

function parsePositiveInteger(value: string) {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

function parseNonNegativeCzk(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
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
