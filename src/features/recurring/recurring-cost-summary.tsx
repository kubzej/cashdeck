import { useMemo, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { formatCzk } from '../../lib/format-czk'
import { CategoryIcon } from '../categories/category-icon'
import type { CategoryColorKey, CategoryIconKey } from '../categories/api'
import type { RecurringFrequency, RecurringRule } from './api'

type CostCategory = {
  categoryId: string
  categoryName: string
  categoryIconKey: CategoryIconKey
  categoryColorKey: CategoryColorKey
  monthlyCzk: number
  yearlyCzk: number
}

type CostSummary = {
  expenseMonthlyCzk: number
  expenseYearlyCzk: number
  incomeMonthlyCzk: number
  incomeYearlyCzk: number
  cashflowMonthlyCzk: number
  cashflowYearlyCzk: number
  expenseCategories: CostCategory[]
  incomeCategories: CostCategory[]
}

// Days-per-month average (365.2425 / 12) — keeps daily/weekly/biweekly/custom-day rules on the
// same footing as calendar-based ones (monthly, every_two_months, ...) instead of a crude ×30.
const daysPerMonth = 30.436875

function monthlyEquivalent(amountCzk: number, frequency: RecurringFrequency, customIntervalDays: number | null) {
  switch (frequency) {
    case 'daily': return amountCzk * daysPerMonth
    case 'weekly': return amountCzk * (daysPerMonth / 7)
    case 'biweekly': return amountCzk * (daysPerMonth / 14)
    case 'monthly': return amountCzk
    case 'every_two_months': return amountCzk / 2
    case 'every_three_months': return amountCzk / 3
    case 'semiannual': return amountCzk / 6
    case 'yearly': return amountCzk / 12
    case 'custom_days': return amountCzk * (daysPerMonth / (customIntervalDays ?? 1))
  }
}

// Only active `transaction` rules count — transfers move money between the user's own wallets
// (not a real cost or income, same convention Overview/category totals already use everywhere
// else), and an ended rule no longer represents a live recurring cost.
function computeCostSummary(rules: RecurringRule[]): CostSummary {
  const expenseCategories = new Map<string, CostCategory>()
  const incomeCategories = new Map<string, CostCategory>()
  let expenseMonthlyCzk = 0
  let incomeMonthlyCzk = 0

  for (const rule of rules) {
    if (rule.status !== 'active' || rule.kind !== 'transaction') continue
    if (!rule.categoryId || !rule.categoryName || !rule.categoryIconKey || !rule.categoryColorKey || !rule.categoryDirection) continue

    const monthlyCzk = monthlyEquivalent(rule.amountCzk, rule.frequency, rule.customIntervalDays)
    const buckets = rule.categoryDirection === 'income' ? incomeCategories : expenseCategories
    const existing = buckets.get(rule.categoryId)
    if (existing) existing.monthlyCzk += monthlyCzk
    else buckets.set(rule.categoryId, { categoryId: rule.categoryId, categoryName: rule.categoryName, categoryIconKey: rule.categoryIconKey, categoryColorKey: rule.categoryColorKey, monthlyCzk, yearlyCzk: 0 })

    if (rule.categoryDirection === 'income') incomeMonthlyCzk += monthlyCzk
    else expenseMonthlyCzk += monthlyCzk
  }

  const toSortedList = (buckets: Map<string, CostCategory>) =>
    [...buckets.values()]
      .map((entry) => ({ ...entry, monthlyCzk: Math.round(entry.monthlyCzk), yearlyCzk: Math.round(entry.monthlyCzk * 12) }))
      .sort((a, b) => b.monthlyCzk - a.monthlyCzk)

  const cashflowMonthlyCzk = incomeMonthlyCzk - expenseMonthlyCzk
  return {
    expenseMonthlyCzk: Math.round(expenseMonthlyCzk), expenseYearlyCzk: Math.round(expenseMonthlyCzk * 12),
    incomeMonthlyCzk: Math.round(incomeMonthlyCzk), incomeYearlyCzk: Math.round(incomeMonthlyCzk * 12),
    cashflowMonthlyCzk: Math.round(cashflowMonthlyCzk), cashflowYearlyCzk: Math.round(cashflowMonthlyCzk * 12),
    expenseCategories: toSortedList(expenseCategories),
    incomeCategories: toSortedList(incomeCategories),
  }
}

export function RecurringCostSummary({ rules }: { rules: RecurringRule[] }) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const summary = useMemo(() => computeCostSummary(rules), [rules])
  const pick = (monthlyCzk: number, yearlyCzk: number) => period === 'monthly' ? monthlyCzk : yearlyCzk

  if (summary.expenseCategories.length === 0 && summary.incomeCategories.length === 0) return null

  return (
    <section className="recurring-cost-summary" aria-label="Náklady a příjmy z opakování">
      <ToggleGroup type="single" value={period} onValueChange={(next) => { if (next === 'monthly' || next === 'yearly') setPeriod(next) }} width="full" className="recurring-cost-summary__period" aria-label="Období">
        <ToggleGroupItem value="monthly">Měsíčně</ToggleGroupItem>
        <ToggleGroupItem value="yearly">Ročně</ToggleGroupItem>
      </ToggleGroup>

      <div className="recurring-cost-summary__totals">
        <CostTotal label="Výdaje" amountCzk={pick(summary.expenseMonthlyCzk, summary.expenseYearlyCzk)} tone="expense" signed={false} />
        <CostTotal label="Příjmy" amountCzk={pick(summary.incomeMonthlyCzk, summary.incomeYearlyCzk)} tone="income" signed={false} />
        <CostTotal label="Cashflow" amountCzk={pick(summary.cashflowMonthlyCzk, summary.cashflowYearlyCzk)} tone={summary.cashflowMonthlyCzk < 0 ? 'expense' : 'income'} signed />
      </div>

      {summary.expenseCategories.length > 0 ? (
        <CategoryList title="Výdaje podle kategorie" categories={summary.expenseCategories} pick={pick} />
      ) : null}
      {summary.incomeCategories.length > 0 ? (
        <CategoryList title="Příjmy podle kategorie" categories={summary.incomeCategories} pick={pick} />
      ) : null}
    </section>
  )
}

function CostTotal({ label, amountCzk, tone, signed }: { label: string; amountCzk: number; tone: 'expense' | 'income'; signed: boolean }) {
  return (
    <div className="recurring-cost-summary__total">
      <span className="recurring-cost-summary__total-label">{label}</span>
      <strong className={`recurring-cost-summary__total-amount recurring-cost-summary__total-amount--${tone}`}>{formatCzk(amountCzk, { signed })}</strong>
    </div>
  )
}

function CategoryList({ title, categories, pick }: { title: string; categories: CostCategory[]; pick: (monthlyCzk: number, yearlyCzk: number) => number }) {
  return (
    <div className="recurring-cost-summary__categories">
      <h2>{title}</h2>
      <ul className="recurring-cost-summary__category-list">
        {categories.map((category) => (
          <li key={category.categoryId} className="recurring-cost-summary__category-row">
            <span className={`recurring-cost-summary__category-icon color-key--${category.categoryColorKey}`}><CategoryIcon iconKey={category.categoryIconKey} colorKey={category.categoryColorKey} /></span>
            <span className="recurring-cost-summary__category-name">{category.categoryName}</span>
            <span className="recurring-cost-summary__category-amount">{formatCzk(pick(category.monthlyCzk, category.yearlyCzk))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
