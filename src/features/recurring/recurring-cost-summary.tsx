import { useMemo, useState } from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { formatCzk } from '../../lib/format-czk'
import { CategoryIcon } from '../categories/category-icon'
import type { RecurringRule } from './api'
import { computeCostSummary, type CostCategory } from './cost-summary'

export function RecurringCostSummary({ rules }: { rules: RecurringRule[] }) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const summary = useMemo(() => computeCostSummary(rules), [rules])
  const pick = (monthlyCzk: number, yearlyCzk: number) => period === 'monthly' ? monthlyCzk : yearlyCzk

  if (summary.expenseCategories.length === 0 && summary.incomeCategories.length === 0) return null

  return (
    <Card aria-label="Náklady a příjmy z opakování" padding="sm" className="recurring-cost-summary">
      <CardContent className="recurring-cost-summary__body">
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
      </CardContent>
    </Card>
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
