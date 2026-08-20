import { Buffer } from 'node:buffer'
import type { Pool } from 'pg'
import { DomainError } from '../management/domain.js'
import { calculateTransferImpactCzk, type FeedListInput } from './domain.js'

export type FeedLabel = { id: string; name: string }

export type FeedTransaction = {
  kind: 'transaction'
  id: string
  walletId: string
  walletName: string
  categoryId: string
  categoryName: string
  categoryIconKey: string
  categoryColorKey: string
  direction: 'income' | 'expense'
  amountCzk: number
  transactionDate: string
  note: string | null
  labels: FeedLabel[]
}

export type FeedTransfer = {
  kind: 'transfer'
  id: string
  sourceWalletId: string
  sourceWalletName: string
  destinationWalletId: string
  destinationWalletName: string
  amountCzk: number
  impactCzk: number
  transferDate: string
  note: string | null
  labels: FeedLabel[]
}

export type FeedItem = FeedTransaction | FeedTransfer
export type FeedPage = { items: FeedItem[]; nextCursor: string | null }
export type FeedRepository = { listFeed(userId: string, input: FeedListInput): Promise<FeedPage> }

type FeedCursor = { activityDate: string; createdAt: string; kind: 'transaction' | 'transfer'; id: string }
type FeedRow = {
  kind: 'transaction' | 'transfer'
  id: string
  activity_date: string
  created_at: Date
  amount_czk: string
  note: string | null
  wallet_id: string | null
  wallet_name: string | null
  category_id: string | null
  category_name: string | null
  category_icon_key: string | null
  category_color_key: string | null
  direction: 'income' | 'expense' | null
  source_wallet_id: string | null
  source_wallet_name: string | null
  destination_wallet_id: string | null
  destination_wallet_name: string | null
  labels: unknown
}

export function createFeedRepository(pool: Pool): FeedRepository {
  return {
    async listFeed(userId, input) {
      const cursor = input.cursor ? decodeCursor(input.cursor) : null
      const values: unknown[] = [userId]
      const transactionFilters = ['t.user_id = $1']
      const transferFilters = ['tr.user_id = $1']

      transactionFilters.push('not transaction_wallet.is_hidden')
      transferFilters.push('not source_wallet_filter.is_hidden', 'not destination_wallet_filter.is_hidden')

      if (input.walletIds) {
        values.push(input.walletIds)
        const parameter = `$${values.length}::uuid[]`
        transactionFilters.push(`t.wallet_id = any(${parameter})`)
        transferFilters.push(`(tr.source_wallet_id = any(${parameter}) or tr.destination_wallet_id = any(${parameter}))`)
      }
      if (input.dateFrom) {
        values.push(input.dateFrom)
        const parameter = `$${values.length}::date`
        transactionFilters.push(`t.transaction_date >= ${parameter}`)
        transferFilters.push(`tr.transfer_date >= ${parameter}`)
      }
      if (input.dateTo) {
        values.push(input.dateTo)
        const parameter = `$${values.length}::date`
        transactionFilters.push(`t.transaction_date <= ${parameter}`)
        transferFilters.push(`tr.transfer_date <= ${parameter}`)
      }
      if (input.search) {
        values.push(input.search)
        const parameter = `$${values.length}`
        transactionFilters.push(`(
          transaction_category.name ilike '%' || ${parameter} || '%'
          or transaction_wallet.name ilike '%' || ${parameter} || '%'
          or coalesce(t.note, '') ilike '%' || ${parameter} || '%'
          or exists (
            select 1
            from transaction_labels search_transaction_label
            join labels search_label on search_label.user_id = $1 and search_label.id = search_transaction_label.label_id
            where search_transaction_label.user_id = $1
              and search_transaction_label.transaction_id = t.id
              and search_label.name ilike '%' || ${parameter} || '%'
          )
        )`)
        transferFilters.push(`(
          source_wallet_filter.name ilike '%' || ${parameter} || '%'
          or destination_wallet_filter.name ilike '%' || ${parameter} || '%'
          or coalesce(tr.note, '') ilike '%' || ${parameter} || '%'
          or exists (
            select 1
            from transfer_labels search_transfer_label
            join labels search_label on search_label.user_id = $1 and search_label.id = search_transfer_label.label_id
            where search_transfer_label.user_id = $1
              and search_transfer_label.transfer_id = tr.id
              and search_label.name ilike '%' || ${parameter} || '%'
          )
        )`)
      }

      const cursorFilter = cursor ? addCursorFilter(values, cursor) : ''
      values.push(input.limit + 1)
      const result = await pool.query<FeedRow>(feedSelect(transactionFilters.join(' and '), transferFilters.join(' and '), cursorFilter, `$${values.length}`), values)
      const rows = result.rows.slice(0, input.limit)
      const last = rows.at(-1)
      return { items: rows.map((row) => toFeedItem(row, input.walletIds)), nextCursor: result.rows.length > input.limit && last ? encodeCursor(last) : null }
    },
  }
}

function addCursorFilter(values: unknown[], cursor: FeedCursor) {
  values.push(cursor.activityDate, cursor.createdAt, cursor.kind, cursor.id)
  const start = values.length - 3
  return `where (activity_date, created_at, kind, id) < ($${start}::date, $${start + 1}::timestamptz, $${start + 2}::text, $${start + 3}::uuid)`
}

function feedSelect(transactionFilters: string, transferFilters: string, cursorFilter: string, limit: string) {
  return `with activity_rows as (
    select 'transaction'::text as kind, t.id, t.transaction_date as activity_date, t.created_at,
      t.amount_czk, t.note, t.wallet_id, t.category_id,
      null::uuid as source_wallet_id, null::uuid as destination_wallet_id
    from transactions t
    join wallets transaction_wallet on transaction_wallet.user_id = t.user_id and transaction_wallet.id = t.wallet_id
    join categories transaction_category on transaction_category.user_id = t.user_id and transaction_category.id = t.category_id
    where ${transactionFilters}
    union all
    select 'transfer'::text as kind, tr.id, tr.transfer_date as activity_date, tr.created_at,
      tr.amount_czk, tr.note, null::uuid as wallet_id, null::uuid as category_id,
      tr.source_wallet_id, tr.destination_wallet_id
    from transfers tr
    join wallets source_wallet_filter on source_wallet_filter.user_id = tr.user_id and source_wallet_filter.id = tr.source_wallet_id
    join wallets destination_wallet_filter on destination_wallet_filter.user_id = tr.user_id and destination_wallet_filter.id = tr.destination_wallet_id
    where ${transferFilters}
  ), page as (
    select * from activity_rows
    ${cursorFilter}
    order by activity_date desc, created_at desc, kind desc, id desc
    limit ${limit}
  )
  select page.kind, page.id, to_char(page.activity_date, 'YYYY-MM-DD') as activity_date,
    page.created_at, page.amount_czk, page.note,
    page.wallet_id, wallet.name as wallet_name,
    page.category_id, category.name as category_name,
    category.icon_key as category_icon_key, category.color_key as category_color_key,
    category.direction,
    page.source_wallet_id, source_wallet.name as source_wallet_name,
    page.destination_wallet_id, destination_wallet.name as destination_wallet_name,
    coalesce(
      json_agg(json_build_object('id', label.id, 'name', label.name) order by label.normalized_name asc, label.id asc)
        filter (where label.id is not null),
      '[]'::json
    ) as labels
  from page
  left join wallets wallet on wallet.user_id = $1 and wallet.id = page.wallet_id
  left join categories category on category.user_id = $1 and category.id = page.category_id
  left join wallets source_wallet on source_wallet.user_id = $1 and source_wallet.id = page.source_wallet_id
  left join wallets destination_wallet on destination_wallet.user_id = $1 and destination_wallet.id = page.destination_wallet_id
  left join transaction_labels transaction_label on page.kind = 'transaction' and transaction_label.user_id = $1 and transaction_label.transaction_id = page.id
  left join transfer_labels transfer_label on page.kind = 'transfer' and transfer_label.user_id = $1 and transfer_label.transfer_id = page.id
  left join labels label on label.user_id = $1 and label.id = coalesce(transaction_label.label_id, transfer_label.label_id)
  group by page.kind, page.id, page.activity_date, page.created_at, page.amount_czk, page.note,
    page.wallet_id, wallet.name, page.category_id, category.name, category.icon_key, category.color_key, category.direction,
    page.source_wallet_id, source_wallet.name, page.destination_wallet_id, destination_wallet.name
  order by page.activity_date desc, page.created_at desc, page.kind desc, page.id desc`
}

function toFeedItem(row: FeedRow, selectedWalletIds: string[] | null): FeedItem {
  const labels = parseLabels(row.labels)
  if (row.kind === 'transaction') {
    if (!row.wallet_id || !row.wallet_name || !row.category_id || !row.category_name || !row.category_icon_key || !row.category_color_key || !row.direction) throw new Error('Neúplný řádek transakce ve feedu.')
    return { kind: 'transaction', id: row.id, walletId: row.wallet_id, walletName: row.wallet_name, categoryId: row.category_id, categoryName: row.category_name, categoryIconKey: row.category_icon_key, categoryColorKey: row.category_color_key, direction: row.direction, amountCzk: Number(row.amount_czk), transactionDate: row.activity_date, note: row.note, labels }
  }
  if (!row.source_wallet_id || !row.source_wallet_name || !row.destination_wallet_id || !row.destination_wallet_name) throw new Error('Neúplný řádek převodu ve feedu.')
  const amountCzk = Number(row.amount_czk)
  return { kind: 'transfer', id: row.id, sourceWalletId: row.source_wallet_id, sourceWalletName: row.source_wallet_name, destinationWalletId: row.destination_wallet_id, destinationWalletName: row.destination_wallet_name, amountCzk, impactCzk: calculateTransferImpactCzk({ amountCzk, sourceWalletId: row.source_wallet_id, destinationWalletId: row.destination_wallet_id, selectedWalletIds }), transferDate: row.activity_date, note: row.note, labels }
}

function parseLabels(value: unknown): FeedLabel[] {
  const labels = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(labels)) return []
  return labels.filter((label): label is FeedLabel => typeof label === 'object' && label !== null && 'id' in label && 'name' in label && typeof label.id === 'string' && typeof label.name === 'string')
}

function encodeCursor(row: FeedRow) {
  return Buffer.from(JSON.stringify({ activityDate: row.activity_date, createdAt: row.created_at.toISOString(), kind: row.kind, id: row.id } satisfies FeedCursor)).toString('base64url')
}

function decodeCursor(cursor: string): FeedCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<FeedCursor>
    if (typeof parsed.activityDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.activityDate) && typeof parsed.createdAt === 'string' && !Number.isNaN(new Date(parsed.createdAt).valueOf()) && (parsed.kind === 'transaction' || parsed.kind === 'transfer') && typeof parsed.id === 'string' && /^[0-9a-f-]{36}$/i.test(parsed.id)) return parsed as FeedCursor
  } catch {
    // The generic validation error below intentionally does not expose parser details.
  }
  throw new DomainError(400, 'Kurzór přehledu není platný.')
}
