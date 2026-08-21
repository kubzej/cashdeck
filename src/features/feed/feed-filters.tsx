import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Check, Search, WalletCards } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { DatePicker } from '../../components/ui/calendar'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Field, FieldLabel } from '../../components/ui/field'
import { Input } from '../../components/ui/input'
import type { Wallet } from '../wallets/api'
import './feed-filters.css'

export type FeedPeriod = 'week' | 'month' | 'year' | 'all' | 'custom'

export type FeedFilterValue = {
  walletIds: string[]
  period: FeedPeriod
  periodAnchor: string
  customDateFrom: string
  customDateTo: string
  search: string
}

export type FeedDateRange = { dateFrom?: string; dateTo?: string }

export function createDefaultFeedFilters(): FeedFilterValue {
  const today = getFeedToday()
  const currentMonth = getMonthRange(today)
  return { walletIds: [], period: 'month', periodAnchor: today, customDateFrom: currentMonth.dateFrom, customDateTo: currentMonth.dateTo, search: '' }
}

export function resolveFeedDateRange(value: FeedFilterValue): FeedDateRange {
  if (value.period === 'all') return {}
  if (value.period === 'custom') return { dateFrom: value.customDateFrom || undefined, dateTo: value.customDateTo || undefined }
  if (value.period === 'week') return getWeekRange(value.periodAnchor)
  if (value.period === 'year') return { dateFrom: `${value.periodAnchor.slice(0, 4)}-01-01`, dateTo: `${value.periodAnchor.slice(0, 4)}-12-31` }
  return getMonthRange(value.periodAnchor)
}

export function FeedFilters({ wallets, value, onChange, showSearch = true, ariaLabel = 'Filtry transakcí' }: { wallets: Wallet[]; value: FeedFilterValue; onChange: (value: FeedFilterValue) => void; showSearch?: boolean; ariaLabel?: string }) {
  const visibleWallets = useMemo(() => wallets.filter((wallet) => !wallet.isHidden), [wallets])
  const walletLabel = getWalletLabel(value.walletIds, visibleWallets)
  const dateRange = resolveFeedDateRange(value)

  return <section className="feed-filters" aria-label={ariaLabel}>
    {showSearch ? <div className="feed-filters__search">
      <Search aria-hidden="true" />
      <Input aria-label="Hledat v transakcích" value={value.search} placeholder="Hledat" onChange={(event) => onChange({ ...value, search: event.currentTarget.value })} />
    </div> : null}
    <div className="feed-filters__controls">
      <WalletFilterDialog wallets={visibleWallets} selectedWalletIds={value.walletIds} label={walletLabel} onApply={(walletIds) => onChange({ ...value, walletIds })} />
      <PeriodFilterDialog value={value} label={getPeriodLabel(value.period, dateRange)} onApply={(next) => onChange({ ...value, ...next, periodAnchor: next.period !== value.period && isNavigablePeriod(next.period) ? getFeedToday() : value.periodAnchor })} />
    </div>
  </section>
}

function WalletFilterDialog({ wallets, selectedWalletIds, label, onApply }: { wallets: Wallet[]; selectedWalletIds: string[]; label: string; onApply: (walletIds: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(selectedWalletIds)

  useEffect(() => { if (open) setDraft(selectedWalletIds) }, [open, selectedWalletIds])

  function toggleWallet(walletId: string) {
    setDraft((current) => current.includes(walletId) ? current.filter((id) => id !== walletId) : [...current, walletId])
  }

  function apply() {
    onApply(draft)
    setOpen(false)
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <Button variant="outline" className="feed-filter-button" aria-label="Nastavit filtr účtů" onClick={() => setOpen(true)}><WalletCards aria-hidden="true" /><span>{label}</span></Button>
    <DialogContent size="sm" className="feed-filter-dialog">
      <DialogHeader><DialogTitle>Peněženky</DialogTitle></DialogHeader>
      <DialogBody><div className="feed-wallet-options">
        <button type="button" className="feed-wallet-option" data-selected={draft.length === 0 || undefined} onClick={() => setDraft([])}><span>Všechny peněženky</span>{draft.length === 0 ? <Check aria-hidden="true" /> : null}</button>
        {wallets.map((wallet) => <button type="button" key={wallet.id} className="feed-wallet-option" data-selected={draft.includes(wallet.id) || undefined} onClick={() => toggleWallet(wallet.id)}><WalletCards className={`color-key--${wallet.colorKey}`} aria-hidden="true" /><span>{wallet.name}</span>{draft.includes(wallet.id) ? <Check aria-hidden="true" /> : null}</button>)}
      </div></DialogBody>
      <DialogFooter><Button onClick={apply}>Použít filtr</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function PeriodFilterDialog({ value, label, onApply }: { value: FeedFilterValue; label: string; onApply: (value: Pick<FeedFilterValue, 'period' | 'customDateFrom' | 'customDateTo'>) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Pick<FeedFilterValue, 'period' | 'customDateFrom' | 'customDateTo'>>({ period: value.period, customDateFrom: value.customDateFrom, customDateTo: value.customDateTo })

  useEffect(() => { if (open) setDraft({ period: value.period, customDateFrom: value.customDateFrom, customDateTo: value.customDateTo }) }, [open, value])

  function apply() {
    if (draft.period === 'custom' && (!draft.customDateFrom || !draft.customDateTo || draft.customDateFrom > draft.customDateTo)) return
    onApply(draft)
    setOpen(false)
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <Button variant="outline" className="feed-filter-button" aria-label={`Filtrovat období: ${label}`} onClick={() => setOpen(true)}><CalendarRange aria-hidden="true" /><span>{label}</span></Button>
    <DialogContent size="sm" className="feed-filter-dialog">
      <DialogHeader><DialogTitle>Období</DialogTitle></DialogHeader>
      <DialogBody><div className="feed-period-options">
        {([['week', 'Tento týden'], ['month', 'Tento měsíc'], ['year', 'Tento rok'], ['all', 'Celá historie'], ['custom', 'Vlastní období']] as const).map(([period, periodLabel]) => <button type="button" key={period} className="feed-period-option" data-selected={draft.period === period || undefined} onClick={() => setDraft((current) => ({ ...current, period }))}>{periodLabel}{draft.period === period ? <Check aria-hidden="true" /> : null}</button>)}
      </div>
      {draft.period === 'custom' ? <div className="feed-custom-range">
        <Field><FieldLabel>Od</FieldLabel><DatePicker value={parseIsoDate(draft.customDateFrom)} onValueChange={(date) => setDraft((current) => ({ ...current, customDateFrom: formatIsoDate(date) }))} locale="cs-CZ" startOfWeek={1} /></Field>
        <Field><FieldLabel>Do</FieldLabel><DatePicker value={parseIsoDate(draft.customDateTo)} onValueChange={(date) => setDraft((current) => ({ ...current, customDateTo: formatIsoDate(date) }))} locale="cs-CZ" startOfWeek={1} /></Field>
      </div> : null}</DialogBody>
      <DialogFooter><Button onClick={apply} disabled={draft.period === 'custom' && (!draft.customDateFrom || !draft.customDateTo || draft.customDateFrom > draft.customDateTo)}>Použít filtr</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function getWalletLabel(selectedWalletIds: string[], wallets: Wallet[]) {
  if (selectedWalletIds.length === 0) return 'Všechny peněženky'
  if (selectedWalletIds.length === 1) return wallets.find((wallet) => wallet.id === selectedWalletIds[0])?.name ?? '1 peněženka'
  return `${selectedWalletIds.length} peněženky`
}

export function shiftFeedPeriod(anchor: string, period: Exclude<FeedPeriod, 'all' | 'custom'>, offset: number) {
  const date = parseIsoDate(anchor)
  if (period === 'week') date.setDate(date.getDate() + offset * 7)
  if (period === 'month') date.setMonth(date.getMonth() + offset)
  if (period === 'year') date.setFullYear(date.getFullYear() + offset)
  return formatIsoDate(date)
}

export function formatFeedPeriodTitle(period: Exclude<FeedPeriod, 'all' | 'custom'>, anchor: string) {
  const date = parseIsoDate(anchor)
  if (period === 'year') return String(date.getFullYear())
  if (period === 'month') return new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(date)
  const range = getWeekRange(anchor)
  return `${formatShortDate(range.dateFrom)} - ${formatShortDate(range.dateTo)}`
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'short' }).format(parseIsoDate(value))
}

export function isNavigablePeriod(period: FeedPeriod): period is Exclude<FeedPeriod, 'all' | 'custom'> { return period === 'week' || period === 'month' || period === 'year' }

function getPeriodLabel(period: FeedPeriod, range: FeedDateRange) {
  if (period === 'week') return 'Po týdnech'
  if (period === 'month') return 'Po měsících'
  if (period === 'year') return 'Po letech'
  if (period === 'all') return 'Celá historie'
  return range.dateFrom && range.dateTo ? 'Vlastní období' : 'Vyber období'
}

export function getFeedToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getMonthRange(today: string) { const [year, month] = today.split('-').map(Number); return { dateFrom: `${year}-${String(month).padStart(2, '0')}-01`, dateTo: formatIsoDate(new Date(year, month, 0)) } }
function getWeekRange(today: string) { const date = parseIsoDate(today); const day = (date.getDay() + 6) % 7; const from = new Date(date); from.setDate(date.getDate() - day); const to = new Date(from); to.setDate(from.getDate() + 6); return { dateFrom: formatIsoDate(from), dateTo: formatIsoDate(to) } }
function parseIsoDate(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day) }
function formatIsoDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` }
