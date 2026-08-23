import { useEffect, useState, type FormEvent } from 'react'
import { CircleAlert, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { ScreenHeader } from '../../components/screen-header'
import { FeedbackState, FeedbackStateActions, FeedbackStateContent, FeedbackStateDescription, FeedbackStateIcon, FeedbackStateTitle } from '../../components/ui/feedback-state'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import { List, ListItem, ListItemActions, ListItemContent, ListItemTitle } from '../../components/ui/list'
import { Skeleton } from '../../components/ui/skeleton'
import { formatCzk } from '../../lib/format-czk'
import {
  createIrregularExpense,
  deleteIrregularExpense,
  getIndependenceSettings,
  listIrregularExpenses,
  saveIndependenceSettings,
  updateIrregularExpense,
  type IndependenceSettings,
  type IrregularExpense,
} from './api'
import './independence.css'

const categoryFields = [
  ['housingMonthlyCzk', 'Bydlení'],
  ['foodMonthlyCzk', 'Jídlo a domácnost'],
  ['transportMonthlyCzk', 'Doprava'],
  ['healthMonthlyCzk', 'Zdraví a pojištění'],
  ['leisureMonthlyCzk', 'Volný čas a cestování'],
  ['clothingMonthlyCzk', 'Oblečení a osobní věci'],
  ['familyMonthlyCzk', 'Rodina'],
  ['reserveMonthlyCzk', 'Rezerva / ostatní'],
] as const satisfies ReadonlyArray<readonly [keyof IndependenceSettings, string]>

type FormValues = Record<keyof IndependenceSettings, string>

const defaultValues: FormValues = {
  withdrawalRatePercent: '4',
  expectedRealReturnPercent: '4',
  inflationRatePercent: '2.5',
  monthlyContributionCzk: '',
  housingMonthlyCzk: '',
  foodMonthlyCzk: '',
  transportMonthlyCzk: '',
  healthMonthlyCzk: '',
  leisureMonthlyCzk: '',
  clothingMonthlyCzk: '',
  familyMonthlyCzk: '',
  reserveMonthlyCzk: '',
}

function toFormValues(settings: IndependenceSettings): FormValues {
  return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])) as FormValues
}

export function IndependenceSettingsScreen({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [values, setValues] = useState<FormValues>(defaultValues)
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)
  const [irregularExpenses, setIrregularExpenses] = useState<IrregularExpense[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    Promise.all([getIndependenceSettings(), listIrregularExpenses()])
      .then(([settingsResult, irregularResult]) => {
        if (controller.signal.aborted) return
        if (settingsResult.settings) setValues(toFormValues(settingsResult.settings))
        setIrregularExpenses(irregularResult.items)
        setStatus('ready')
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [reloadToken])

  const annualCategoriesCzk = categoryFields.reduce((sum, [key]) => sum + (parseNonNegativeCzk(values[key]) ?? 0), 0) * 12
  const annualIrregularCzk = irregularExpenses.reduce((sum, item) => sum + item.amountCzk / item.frequencyYears, 0)
  const annualExpensesCzk = Math.round(annualCategoriesCzk + annualIrregularCzk)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof FormValues, string>> = {}
    const withdrawalRatePercent = parsePercent(values.withdrawalRatePercent, 0.01, 20)
    const expectedRealReturnPercent = parsePercent(values.expectedRealReturnPercent, 0, 20)
    const inflationRatePercent = parsePercent(values.inflationRatePercent, 0, 20)
    const monthlyContributionCzk = parseNonNegativeCzk(values.monthlyContributionCzk)
    if (withdrawalRatePercent === null) nextErrors.withdrawalRatePercent = 'Zadej sazbu mezi 0,01 a 20 %.'
    if (expectedRealReturnPercent === null) nextErrors.expectedRealReturnPercent = 'Zadej hodnotu mezi 0 a 20 %.'
    if (inflationRatePercent === null) nextErrors.inflationRatePercent = 'Zadej hodnotu mezi 0 a 20 %.'
    if (monthlyContributionCzk === null) nextErrors.monthlyContributionCzk = 'Zadej celé nezáporné číslo.'
    const categoryAmounts: Partial<Record<keyof FormValues, number>> = {}
    for (const [key] of categoryFields) {
      const amount = parseNonNegativeCzk(values[key])
      if (amount === null) nextErrors[key] = 'Zadej celé nezáporné číslo.'
      else categoryAmounts[key] = amount
    }
    setErrors(nextErrors)
    setSubmissionError(null)
    setSavedNotice(false)
    if (Object.keys(nextErrors).length > 0 || withdrawalRatePercent === null || expectedRealReturnPercent === null || inflationRatePercent === null || monthlyContributionCzk === null) return

    setIsSubmitting(true)
    try {
      await saveIndependenceSettings({
        withdrawalRatePercent,
        expectedRealReturnPercent,
        inflationRatePercent,
        monthlyContributionCzk,
        housingMonthlyCzk: categoryAmounts.housingMonthlyCzk ?? 0,
        foodMonthlyCzk: categoryAmounts.foodMonthlyCzk ?? 0,
        transportMonthlyCzk: categoryAmounts.transportMonthlyCzk ?? 0,
        healthMonthlyCzk: categoryAmounts.healthMonthlyCzk ?? 0,
        leisureMonthlyCzk: categoryAmounts.leisureMonthlyCzk ?? 0,
        clothingMonthlyCzk: categoryAmounts.clothingMonthlyCzk ?? 0,
        familyMonthlyCzk: categoryAmounts.familyMonthlyCzk ?? 0,
        reserveMonthlyCzk: categoryAmounts.reserveMonthlyCzk ?? 0,
      })
      setSavedNotice(true)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Nastavení se nepodařilo uložit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="independence-settings-screen" aria-labelledby="independence-settings-title">
      <ScreenHeader title="Nezávislost" titleId="independence-settings-title" backLabel="Zpět do nastavení" onBack={onBack} />

      {status === 'loading' ? <div className="independence-settings-loading" aria-label="Načítání nastavení"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : null}

      {status === 'error' ? (
        <FeedbackState status="error" layout="panel" className="independence-settings-feedback">
          <FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon>
          <FeedbackStateContent><FeedbackStateTitle>Nastavení se nepodařilo načíst</FeedbackStateTitle><FeedbackStateDescription>Zkus to prosím znovu.</FeedbackStateDescription></FeedbackStateContent>
          <FeedbackStateActions><Button variant="outline" onClick={() => setReloadToken((current) => current + 1)}><RefreshCw aria-hidden="true" />Zkusit znovu</Button></FeedbackStateActions>
        </FeedbackState>
      ) : null}

      {status === 'ready' ? (
        <form className="independence-settings-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          {submissionError ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateTitle>Nastavení se nepodařilo uložit</FeedbackStateTitle><FeedbackStateDescription>{submissionError}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
          {savedNotice ? <FeedbackState status="success" layout="inline"><FeedbackStateContent><FeedbackStateTitle>Nastavení uloženo</FeedbackStateTitle></FeedbackStateContent></FeedbackState> : null}

          <Card render={<section aria-labelledby="independence-parameters-title" />} padding="none" className="independence-settings-section">
            <h2 id="independence-parameters-title">Parametry</h2>
            <Field invalid={Boolean(errors.withdrawalRatePercent)}>
              <FieldLabel>Výběrová sazba (%)</FieldLabel>
              <Input type="text" inputMode="decimal" value={values.withdrawalRatePercent} onChange={(event) => { const withdrawalRatePercent = event.currentTarget.value; setValues((current) => ({ ...current, withdrawalRatePercent })) }} />
              <FieldDescription>Kolik % investičního jmění ročně bezpečně vybíráš. Typicky 3,5–4 %; nižší číslo = vyšší cílová částka.</FieldDescription>
              <FieldError match={Boolean(errors.withdrawalRatePercent)}>{errors.withdrawalRatePercent}</FieldError>
            </Field>
            <Field invalid={Boolean(errors.expectedRealReturnPercent)}>
              <FieldLabel>Očekávaný reálný výnos (%)</FieldLabel>
              <Input type="text" inputMode="decimal" value={values.expectedRealReturnPercent} onChange={(event) => { const expectedRealReturnPercent = event.currentTarget.value; setValues((current) => ({ ...current, expectedRealReturnPercent })) }} />
              <FieldDescription>Průměrný roční výnos investic po odečtení inflace. Používá se pro odhad, za kolik let dosáhneš cíle.</FieldDescription>
              <FieldError match={Boolean(errors.expectedRealReturnPercent)}>{errors.expectedRealReturnPercent}</FieldError>
            </Field>
            <Field invalid={Boolean(errors.inflationRatePercent)}>
              <FieldLabel>Míra inflace (%)</FieldLabel>
              <Input type="text" inputMode="decimal" value={values.inflationRatePercent} onChange={(event) => { const inflationRatePercent = event.currentTarget.value; setValues((current) => ({ ...current, inflationRatePercent })) }} />
              <FieldDescription>Používá se jen k dopočtu, kolik budou tvoje dnešní náklady stát v budoucích cenách.</FieldDescription>
              <FieldError match={Boolean(errors.inflationRatePercent)}>{errors.inflationRatePercent}</FieldError>
            </Field>
            <Field invalid={Boolean(errors.monthlyContributionCzk)}>
              <FieldLabel>Plánovaný měsíční vklad</FieldLabel>
              <Input type="text" inputMode="numeric" value={values.monthlyContributionCzk} onChange={(event) => { const monthlyContributionCzk = event.currentTarget.value; setValues((current) => ({ ...current, monthlyContributionCzk })) }} />
              <FieldDescription>Kolik plánuješ měsíčně přidávat do investic. Dlouhodobý odhad, appka to nesleduje z reálných dat.</FieldDescription>
              <FieldError match={Boolean(errors.monthlyContributionCzk)}>{errors.monthlyContributionCzk}</FieldError>
            </Field>
          </Card>

          <Card render={<section aria-labelledby="independence-expenses-title" />} padding="none" className="independence-settings-section">
            <div className="independence-settings-section__heading">
              <h2 id="independence-expenses-title">Roční náklady</h2>
              <strong>{formatCzk(annualExpensesCzk)}</strong>
            </div>
            {categoryFields.map(([key, label]) => (
              <Field key={key} invalid={Boolean(errors[key])}>
                <FieldLabel>{label} (měsíčně)</FieldLabel>
                <Input type="text" inputMode="numeric" value={values[key]} onChange={(event) => { const value = event.currentTarget.value; setValues((current) => ({ ...current, [key]: value })) }} />
                {key === 'reserveMonthlyCzk' ? <FieldDescription>Bezpečnostní polštář pro věci mimo ostatní kategorie nebo běžnou měsíční nejistotu v útratě. Počítá se stejně jako ostatní kategorie (× 12 ročně) — na jednorázové velké výdaje jednou za pár let použij Nepravidelné výdaje níže.</FieldDescription> : null}
                <FieldError match={Boolean(errors[key])}>{errors[key]}</FieldError>
              </Field>
            ))}
          </Card>

          <Button type="submit" size="lg" className="independence-settings-submit" loading={isSubmitting}>Uložit nastavení</Button>
        </form>
      ) : null}

      {status === 'ready' ? <IrregularExpensesSection irregularExpenses={irregularExpenses} onChanged={() => setReloadToken((current) => current + 1)} /> : null}
    </section>
  )
}

function IrregularExpensesSection({ irregularExpenses, onChanged }: { irregularExpenses: IrregularExpense[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<IrregularExpense | 'new' | null>(null)

  return (
    <Card render={<section aria-labelledby="independence-irregular-title" />} padding="none" className="independence-settings-section">
      <div className="independence-settings-section__heading">
        <h2 id="independence-irregular-title">Nepravidelné výdaje</h2>
        <Button type="button" variant="ghost" size="icon" aria-label="Přidat nepravidelný výdaj" onClick={() => setEditing('new')}><Plus aria-hidden="true" /></Button>
      </div>
      {irregularExpenses.length === 0 ? <p className="independence-irregular-empty">Zatím žádné nepravidelné výdaje.</p> : (
        <List gap="sm">
          {irregularExpenses.map((item) => (
            <ListItem key={item.id} variant="quiet" size="default" className="surface-row independence-irregular-row">
              <ListItemContent>
                <ListItemTitle>{item.name}</ListItemTitle>
                <span className="independence-irregular-row__meta">{formatCzk(item.amountCzk)}, jednou za {item.frequencyYears} {item.frequencyYears === 1 ? 'rok' : item.frequencyYears >= 2 && item.frequencyYears <= 4 ? 'roky' : 'let'}</span>
                <span className="independence-irregular-row__annual">ročně {formatCzk(Math.round(item.amountCzk / item.frequencyYears))}</span>
              </ListItemContent>
              <ListItemActions>
                <Button type="button" variant="ghost" size="icon" aria-label={`Upravit ${item.name}`} onClick={() => setEditing(item)}><Pencil aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Smazat ${item.name}`} onClick={() => void deleteIrregularExpense(item.id).then(onChanged)}><Trash2 aria-hidden="true" /></Button>
              </ListItemActions>
            </ListItem>
          ))}
        </List>
      )}
      {editing ? <IrregularExpenseForm item={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} /> : null}
    </Card>
  )
}

function IrregularExpenseForm({ item, onCancel, onSaved }: { item: IrregularExpense | null; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [amountCzk, setAmountCzk] = useState(item ? String(item.amountCzk) : '')
  const [frequencyYears, setFrequencyYears] = useState(item ? String(item.frequencyYears) : '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = parsePositiveCzk(amountCzk)
    const frequency = parsePositiveInteger(frequencyYears)
    if (!name.trim() || amount === null || frequency === null) {
      setError('Vyplň název, kladnou částku a kladnou frekvenci v letech.')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      if (item) await updateIrregularExpense(item.id, { name: name.trim(), amountCzk: amount, frequencyYears: frequency })
      else await createIrregularExpense({ name: name.trim(), amountCzk: amount, frequencyYears: frequency })
      onSaved()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Položku se nepodařilo uložit.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="independence-irregular-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {error ? <FeedbackState status="error" layout="inline"><FeedbackStateIcon><CircleAlert aria-hidden="true" /></FeedbackStateIcon><FeedbackStateContent><FeedbackStateDescription>{error}</FeedbackStateDescription></FeedbackStateContent></FeedbackState> : null}
      <Field><FieldLabel>Název</FieldLabel><Input autoFocus value={name} placeholder="Např. Výměna auta" onChange={(event) => setName(event.currentTarget.value)} /></Field>
      <Field><FieldLabel>Částka</FieldLabel><Input type="text" inputMode="numeric" value={amountCzk} placeholder="např. 400000" onChange={(event) => setAmountCzk(event.currentTarget.value)} /></Field>
      <Field><FieldLabel>Frekvence (roky)</FieldLabel><Input type="text" inputMode="numeric" value={frequencyYears} placeholder="např. 8" onChange={(event) => setFrequencyYears(event.currentTarget.value)} /><FieldDescription>Jak často výdaj nastává. Např. 8 = jednou za 8 let (appka si sama spočítá roční ekvivalent).</FieldDescription></Field>
      <div className="independence-irregular-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Zrušit</Button>
        <Button type="submit" loading={isSaving}>{item ? 'Uložit' : 'Přidat'}</Button>
      </div>
    </form>
  )
}

function parsePercent(value: string, min: number, max: number) {
  const normalized = value.replace(',', '.').trim()
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const amount = Number(normalized)
  return amount >= min && amount <= max ? amount : null
}

function parseNonNegativeCzk(value: string) {
  const normalized = value.replaceAll(/\s/g, '')
  if (normalized === '') return 0
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : null
}

function parsePositiveCzk(value: string) {
  const amount = parseNonNegativeCzk(value)
  return amount !== null && amount > 0 ? amount : null
}

function parsePositiveInteger(value: string) {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}
