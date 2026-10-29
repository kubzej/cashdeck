import { useMemo, useState, type CSSProperties } from 'react'
import { formatPercent, formatYears } from '../../lib/format'
import { parseNonNegativeCzk, parsePositiveInteger, parseScenarioPercent, resolveField } from '../../lib/amount-input'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { formatCzk } from '../../lib/format-czk'
import type { IndependenceSettings } from './api'
import { computeCoastFire, targetYear } from './projection'

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

  // Nothing here is saved, so a field only has to be a number, apart from what the maths cannot take
  // (a return of -100 % or less). Text that is filled in but unusable keeps the saved value and says so.
  const horizon = resolveField(values.horizonYears, parsePositiveInteger(values.horizonYears), defaultHorizonYears, 'Zadej celý počet let větší než nula.')
  const realReturn = resolveField(values.realReturnPercent, parseScenarioPercent(values.realReturnPercent, { above: -100 }), settings.expectedRealReturnPercent, 'Zadej číslo větší než −100 a nejvýše 10 000.')
  const monthlyContribution = resolveField(values.monthlyContributionCzk, parseNonNegativeCzk(values.monthlyContributionCzk), settings.monthlyContributionCzk, 'Zadej celé koruny.')
  const customTarget = resolveField(values.customTargetCzk, parseNonNegativeCzk(values.customTargetCzk), 0, 'Zadej celé koruny.')
  const horizonYears = horizon.value
  const realReturnPercent = realReturn.value
  const monthlyContributionCzk = monthlyContribution.value
  const hasCustomTarget = customTarget.value > 0
  const errors = { horizonYears: horizon.error, realReturnPercent: realReturn.error, monthlyContributionCzk: monthlyContribution.error, customTargetCzk: customTarget.error }
  const targetCzk = hasCustomTarget ? customTarget.value : independenceNumberCzk

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
          <span className="independence-coast__stat-caption">máš {formatCzk(totalWealthCzk)} ({formatPercent(progressPercent, 0)})</span>
        </div>

        <p className="independence-coast__result">
          {result.isCoastingAlready
            ? `Už jsi na Coast FIRE! I kdybys dnes úplně přestal spořit, za ${formatYears(horizonYears)} bys díky růstu investic dosáhl cíle sám.`
            : result.yearsToCoast !== null
              ? `Coast FIRE dosáhneš za ${formatYears(result.yearsToCoast)} (kolem roku ${targetYear(result.yearsToCoast)}), kdy budeš mít ${formatCzk(Math.round(result.coastDateWealthCzk ?? 0))}. Od tohoto bodu bys mohl přestat spořit a pořád bys stihl cíl do ${formatYears(horizonYears)}.`
              : `Při současném měsíčním vkladu (${formatCzk(monthlyContributionCzk)}) a horizontu ${formatYears(horizonYears)} se do Coast FIRE nedostaneš — zkus horizont prodloužit nebo vklad zvýšit.`}
        </p>

        <form className="independence-coast__form" onSubmit={(event) => event.preventDefault()} noValidate>
          <Field invalid={Boolean(errors.horizonYears)}>
            <FieldLabel>Chci být nezávislý nejpozději za (let)</FieldLabel>
            <Input type="text" inputMode="numeric" value={values.horizonYears} onChange={(event) => setValue('horizonYears', event.currentTarget.value)} />
            <FieldError match={Boolean(errors.horizonYears)}>{errors.horizonYears}</FieldError>
            <FieldDescription>I kdybys od nějakého bodu přestal úplně spořit, chceš mít cílovou částku nejpozději za tolik let.</FieldDescription>
          </Field>
          <Field invalid={Boolean(errors.realReturnPercent)}>
            <FieldLabel>Očekávaný reálný výnos (%)</FieldLabel>
            <Input type="text" inputMode="decimal" value={values.realReturnPercent} onChange={(event) => setValue('realReturnPercent', event.currentTarget.value)} />
            <FieldError match={Boolean(errors.realReturnPercent)}>{errors.realReturnPercent}</FieldError>
          </Field>
          <Field invalid={Boolean(errors.monthlyContributionCzk)}>
            <FieldLabel>Měsíční vklad</FieldLabel>
            <Input type="text" inputMode="numeric" value={values.monthlyContributionCzk} onChange={(event) => setValue('monthlyContributionCzk', event.currentTarget.value)} />
            <FieldError match={Boolean(errors.monthlyContributionCzk)}>{errors.monthlyContributionCzk}</FieldError>
            <FieldDescription>Kolik do bodu Coast FIRE ještě plánuješ měsíčně přidávat.</FieldDescription>
          </Field>
          <div className="independence-coast__group">
            <span className="independence-coast__group-label">Cílová částka</span>
            <Field invalid={Boolean(errors.customTargetCzk)}>
              <FieldLabel>Vlastní cíl (nepovinné)</FieldLabel>
              <Input type="text" inputMode="numeric" placeholder={new Intl.NumberFormat('cs-CZ').format(independenceNumberCzk)} value={values.customTargetCzk} onChange={(event) => setValue('customTargetCzk', event.currentTarget.value)} />
              <FieldError match={Boolean(errors.customTargetCzk)}>{errors.customTargetCzk}</FieldError>
            </Field>
            <p className="independence-coast__group-hint">{hasCustomTarget ? 'Přepisuje tvůj skutečný cíl nezávislosti.' : `Necháš-li prázdné, počítá se s tvým skutečným cílem (${formatCzk(independenceNumberCzk)}).`}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setValues(defaultValues(settings, defaultHorizonYears))}>Vrátit na aktuální nastavení</Button>
        </form>
      </CardContent>
    </Card>
  )
}

