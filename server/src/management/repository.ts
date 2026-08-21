import { Buffer } from 'node:buffer'
import type { Pool, PoolClient } from 'pg'
import type { CategoryDirection, CategoryIconKey, ColorKey, WalletType } from './domain.js'
import { DomainError } from './domain.js'
import { getPragueToday } from '../recurring/schedule.js'
import { invalidateWealthCache } from '../wealth-cache.js'

export type Wallet = {
  id: string
  name: string
  colorKey: string
  walletType: WalletType
  countsTowardIndependence: boolean
  availableNow: boolean
  openingBalanceCzk: number
  currentBalanceCzk: number
  openingBalanceDate: string
  sortOrder: number
  isHidden: boolean
  openingBalanceLocked: boolean
}

export type Category = {
  id: string
  name: string
  direction: CategoryDirection
  iconKey: string
  colorKey: string
  sortOrder: number
}

export type Label = {
  id: string
  name: string
}

export type LabelPage = {
  items: Label[]
  nextCursor: string | null
}

export type LabelListSort = 'alphabetical' | 'recent'

export type CreateWalletInput = {
  name: string
  colorKey: ColorKey
  openingBalanceCzk: number
  openingBalanceDate: string
  walletType?: WalletType
  countsTowardIndependence?: boolean
  availableNow?: boolean
}

export type UpdateWalletInput = Partial<CreateWalletInput> & {
  isHidden?: boolean
}

export type BalanceAdjustment = {
  id: string
  walletId: string
  amountCzk: number
  operation: 'add' | 'subtract'
  adjustmentDate: string
}

export type BalanceAdjustmentResult = {
  adjustment: BalanceAdjustment | null
  currentBalanceCzk: number
}

export type CreateCategoryInput = {
  name: string
  direction: CategoryDirection
  iconKey: CategoryIconKey
  colorKey: ColorKey
}

export type UpdateCategoryInput = Omit<Partial<CreateCategoryInput>, 'direction'>

type LabelCursor = {
  name: string
  id: string
}

export type ManagementRepository = {
  listWallets(userId: string, includeHidden: boolean): Promise<Wallet[]>
  getWallet(userId: string, walletId: string): Promise<Wallet | null>
  createWallet(userId: string, input: CreateWalletInput): Promise<Wallet>
  updateWallet(userId: string, walletId: string, input: UpdateWalletInput): Promise<Wallet | null>
  reorderWallets(userId: string, walletIds: string[]): Promise<void>
  deleteWallet(userId: string, walletId: string): Promise<boolean>
  createBalanceAdjustment(userId: string, walletId: string, actualBalanceCzk: number): Promise<BalanceAdjustmentResult | null>
  listCategories(userId: string): Promise<Category[]>
  createCategory(userId: string, input: CreateCategoryInput): Promise<Category>
  updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput): Promise<Category | null>
  reorderCategories(userId: string, direction: CategoryDirection, categoryIds: string[]): Promise<void>
  deleteCategory(userId: string, categoryId: string): Promise<boolean>
  listLabels(userId: string, query: string | null, cursor: string | null, limit: number, sort: LabelListSort): Promise<LabelPage>
  createLabel(userId: string, name: string): Promise<Label>
  updateLabel(userId: string, labelId: string, name: string): Promise<Label | null>
  deleteLabel(userId: string, labelId: string): Promise<boolean>
}

type WalletRow = {
  id: string
  name: string
  color_key: string
  wallet_type: WalletType
  counts_toward_independence: boolean
  available_now: boolean
  opening_balance_czk: string
  current_balance_czk: string
  opening_balance_date: string
  sort_order: number
  is_hidden: boolean
  opening_balance_locked: boolean
}

type BalanceAdjustmentRow = {
  id: string
  wallet_id: string
  amount_czk: string
  operation: 'add' | 'subtract'
  adjustment_date: string
}

type CategoryRow = {
  id: string
  name: string
  direction: CategoryDirection
  icon_key: string
  color_key: string
  sort_order: number
}

type LabelRow = {
  id: string
  name: string
  normalized_name: string
}

const walletSelect = `
  with prague_today as (
    select (now() at time zone 'Europe/Prague')::date as value
  ),
  transaction_deltas as (
    select
      t.wallet_id,
      sum(case when c.direction = 'income' then t.amount_czk else -t.amount_czk end) as delta_czk
    from transactions t
    join categories c on c.user_id = t.user_id and c.id = t.category_id
    join wallets w on w.user_id = t.user_id and w.id = t.wallet_id
    cross join prague_today today
    where t.user_id = $1
      and t.transaction_date >= w.opening_balance_date
      and t.transaction_date <= today.value
    group by t.wallet_id
  ),
  transfer_deltas as (
    select tr.source_wallet_id as wallet_id, -sum(tr.amount_czk) as delta_czk
    from transfers tr
    join wallets w on w.user_id = tr.user_id and w.id = tr.source_wallet_id
    cross join prague_today today
    where tr.user_id = $1
      and tr.transfer_date >= w.opening_balance_date
      and tr.transfer_date <= today.value
    group by tr.source_wallet_id

    union all

    select tr.destination_wallet_id as wallet_id, sum(tr.amount_czk) as delta_czk
    from transfers tr
    join wallets w on w.user_id = tr.user_id and w.id = tr.destination_wallet_id
    cross join prague_today today
    where tr.user_id = $1
      and tr.transfer_date >= w.opening_balance_date
      and tr.transfer_date <= today.value
    group by tr.destination_wallet_id
  ),
  adjustment_deltas as (
    select
      ba.wallet_id,
      sum(case when ba.operation = 'add' then ba.amount_czk else -ba.amount_czk end) as delta_czk
    from balance_adjustments ba
    join wallets w on w.user_id = ba.user_id and w.id = ba.wallet_id
    cross join prague_today today
    where ba.user_id = $1
      and ba.adjustment_date >= w.opening_balance_date
      and ba.adjustment_date <= today.value
    group by ba.wallet_id
  ),
  wallet_deltas as (
    select wallet_id, sum(delta_czk)::bigint as delta_czk
    from (
      select wallet_id, delta_czk from transaction_deltas
      union all
      select wallet_id, delta_czk from transfer_deltas
      union all
      select wallet_id, delta_czk from adjustment_deltas
    ) as all_deltas
    group by wallet_id
  )
  select
    w.id,
    w.name,
    w.color_key,
    w.wallet_type,
    w.counts_toward_independence,
    w.available_now,
    w.opening_balance_czk,
    (w.opening_balance_czk + coalesce(wallet_deltas.delta_czk, 0))::bigint as current_balance_czk,
    to_char(w.opening_balance_date, 'YYYY-MM-DD') as opening_balance_date,
    w.sort_order,
    w.is_hidden,
    exists (
      select 1 from transactions t where t.user_id = w.user_id and t.wallet_id = w.id
    ) or exists (
      select 1 from transfers tr
      where tr.user_id = w.user_id and (tr.source_wallet_id = w.id or tr.destination_wallet_id = w.id)
    ) or exists (
      select 1 from balance_adjustments ba where ba.user_id = w.user_id and ba.wallet_id = w.id
    ) as opening_balance_locked
  from wallets w
  left join wallet_deltas on wallet_deltas.wallet_id = w.id
`

function toSafeCzk(value: string | number): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new Error(`Částka ${value} Kč přesahuje bezpečný rozsah pro celé číslo.`)
  return parsed
}

function toWallet(row: WalletRow): Wallet {
  return {
    id: row.id,
    name: row.name,
    colorKey: row.color_key,
    walletType: row.wallet_type,
    countsTowardIndependence: row.counts_toward_independence,
    availableNow: row.available_now,
    openingBalanceCzk: toSafeCzk(row.opening_balance_czk),
    currentBalanceCzk: toSafeCzk(row.current_balance_czk),
    openingBalanceDate: row.opening_balance_date,
    sortOrder: row.sort_order,
    isHidden: row.is_hidden,
    openingBalanceLocked: row.opening_balance_locked,
  }
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    direction: row.direction,
    iconKey: row.icon_key,
    colorKey: row.color_key,
    sortOrder: row.sort_order,
  }
}

function toLabel(row: LabelRow): Label {
  return { id: row.id, name: row.name }
}

export function createManagementRepository(pool: Pool): ManagementRepository {
  return {

    async listWallets(userId, includeHidden) {
      const result = await pool.query<WalletRow>(
        `${walletSelect}
         where w.user_id = $1
           and ($2::boolean or not w.is_hidden)
         order by w.sort_order asc, w.id asc`,
        [userId, includeHidden],
      )

      return result.rows.map(toWallet)
    },

    async getWallet(userId, walletId) {
      const result = await pool.query<WalletRow>(
        `${walletSelect}
         where w.user_id = $1 and w.id = $2`,
        [userId, walletId],
      )

      return result.rows[0] ? toWallet(result.rows[0]) : null
    },

    async createWallet(userId, input) {
      const result = await pool.query<WalletRow>(
        `with next_order as (
           select coalesce(max(sort_order) + 1, 0) as sort_order
           from wallets
           where user_id = $1
         )
         insert into wallets (user_id, name, color_key, wallet_type, counts_toward_independence, available_now, opening_balance_czk, opening_balance_date, sort_order)
         select $1, $2, $3, $4, $5, $6, $7, $8, next_order.sort_order
         from next_order
         returning id, name, color_key, wallet_type, counts_toward_independence, available_now, opening_balance_czk,
           opening_balance_czk as current_balance_czk,
           to_char(opening_balance_date, 'YYYY-MM-DD') as opening_balance_date,
           sort_order, is_hidden, false as opening_balance_locked`,
        [userId, input.name, input.colorKey, input.walletType ?? 'other', input.countsTowardIndependence ?? false, input.availableNow ?? false, input.openingBalanceCzk, input.openingBalanceDate],
      )

      invalidateWealthCache()
      return toWallet(result.rows[0])
    },

    async updateWallet(userId, walletId, input) {
      const assignments: string[] = []
      const values: unknown[] = [userId, walletId]
      const add = (column: string, value: unknown) => {
        values.push(value)
        assignments.push(`${column} = $${values.length}`)
      }

      if (input.name !== undefined) add('name', input.name)
      if (input.colorKey !== undefined) add('color_key', input.colorKey)
      if (input.walletType !== undefined) add('wallet_type', input.walletType)
      if (input.countsTowardIndependence !== undefined) add('counts_toward_independence', input.countsTowardIndependence)
      if (input.availableNow !== undefined) add('available_now', input.availableNow)
      if (input.openingBalanceCzk !== undefined) add('opening_balance_czk', input.openingBalanceCzk)
      if (input.openingBalanceDate !== undefined) add('opening_balance_date', input.openingBalanceDate)
      if (input.isHidden !== undefined) add('is_hidden', input.isHidden)

      if (assignments.length === 0) {
        throw new DomainError(400, 'Chybí změna peněženky.')
      }

      const result = await pool.query(
        `update wallets
         set ${assignments.join(', ')}
         where user_id = $1 and id = $2
         returning id`,
        values,
      )

      if (!result.rows[0]) return null
      invalidateWealthCache()
      return this.getWallet(userId, walletId)
    },

    async reorderWallets(userId, walletIds) {
      await withTransaction(pool, async (client) => {
        const current = await client.query<{ id: string }>(
          `select id from wallets where user_id = $1 order by id asc for update`,
          [userId],
        )
        assertExactIds(current.rows.map((row) => row.id), walletIds, 'peněženek')
        await updateSortOrder(client, 'wallets', userId, walletIds)
      })
    },

    async deleteWallet(userId, walletId) {
      const result = await pool.query(
        `delete from wallets where user_id = $1 and id = $2 returning id`,
        [userId, walletId],
      )
      if (result.rows[0]) invalidateWealthCache()
      return Boolean(result.rows[0])
    },

    async createBalanceAdjustment(userId, walletId, actualBalanceCzk) {
      return withTransaction(pool, async (client) => {
        const lockedWallet = await client.query<{ id: string }>(
          `select id
           from wallets
           where user_id = $1 and id = $2
           for update`,
          [userId, walletId],
        )
        if (!lockedWallet.rows[0]) return null

        const current = await client.query<WalletRow>(
          `${walletSelect}
           where w.user_id = $1 and w.id = $2`,
          [userId, walletId],
        )
        const currentBalanceCzk = Number(current.rows[0].current_balance_czk)
        const differenceCzk = actualBalanceCzk - currentBalanceCzk
        if (differenceCzk === 0) {
          return { adjustment: null, currentBalanceCzk }
        }

        const result = await client.query<BalanceAdjustmentRow>(
          `insert into balance_adjustments (user_id, wallet_id, amount_czk, operation, adjustment_date)
           values ($1, $2, $3, $4, $5)
           returning id, wallet_id, amount_czk, operation, to_char(adjustment_date, 'YYYY-MM-DD') as adjustment_date`,
          [userId, walletId, Math.abs(differenceCzk), differenceCzk > 0 ? 'add' : 'subtract', getPragueToday()],
        )
        const adjustment = result.rows[0]
        invalidateWealthCache()
        return {
          adjustment: {
            id: adjustment.id,
            walletId: adjustment.wallet_id,
            amountCzk: Number(adjustment.amount_czk),
            operation: adjustment.operation,
            adjustmentDate: adjustment.adjustment_date,
          },
          currentBalanceCzk: actualBalanceCzk,
        }
      })
    },

    async listCategories(userId) {
      const result = await pool.query<CategoryRow>(
        `select id, name, direction, icon_key, color_key, sort_order
         from categories
         where user_id = $1
         order by direction asc, sort_order asc, id asc`,
        [userId],
      )
      return result.rows.map(toCategory)
    },

    async createCategory(userId, input) {
      const result = await pool.query<CategoryRow>(
        `with next_order as (
           select coalesce(max(sort_order) + 1, 0) as sort_order
           from categories
           where user_id = $1 and direction = $2
         )
         insert into categories (user_id, name, direction, icon_key, color_key, sort_order)
         select $1, $3, $2, $4, $5, next_order.sort_order
         from next_order
         returning id, name, direction, icon_key, color_key, sort_order`,
        [userId, input.direction, input.name, input.iconKey, input.colorKey],
      )
      return toCategory(result.rows[0])
    },

    async updateCategory(userId, categoryId, input) {
      const assignments: string[] = []
      const values: unknown[] = [userId, categoryId]
      const add = (column: string, value: unknown) => {
        values.push(value)
        assignments.push(`${column} = $${values.length}`)
      }

      if (input.name !== undefined) add('name', input.name)
      if (input.iconKey !== undefined) add('icon_key', input.iconKey)
      if (input.colorKey !== undefined) add('color_key', input.colorKey)

      if (assignments.length === 0) {
        throw new DomainError(400, 'Chybí změna kategorie.')
      }

      const result = await pool.query<CategoryRow>(
        `update categories
         set ${assignments.join(', ')}
         where user_id = $1 and id = $2
         returning id, name, direction, icon_key, color_key, sort_order`,
        values,
      )

      return result.rows[0] ? toCategory(result.rows[0]) : null
    },

    async reorderCategories(userId, direction, categoryIds) {
      await withTransaction(pool, async (client) => {
        const current = await client.query<{ id: string }>(
          `select id from categories where user_id = $1 and direction = $2 order by id asc for update`,
          [userId, direction],
        )
        assertExactIds(current.rows.map((row) => row.id), categoryIds, 'kategorií')
        await updateSortOrder(client, 'categories', userId, categoryIds)
      })
    },

    async deleteCategory(userId, categoryId) {
      const result = await pool.query(
        `delete from categories where user_id = $1 and id = $2 returning id`,
        [userId, categoryId],
      )
      return Boolean(result.rows[0])
    },

    async listLabels(userId, query, cursor, limit, sort) {
      if (sort === 'recent') {
        const values: unknown[] = [userId]
        const filters = ['l.user_id = $1']
        if (query) {
          values.push(`%${query}%`)
          filters.push(`l.normalized_name like $${values.length}`)
        }
        values.push(limit)
        const result = await pool.query<LabelRow>(
          `with recently_used as (
             select tl.label_id, max(t.created_at) as last_used_at
             from transaction_labels tl
             join transactions t on t.user_id = tl.user_id and t.id = tl.transaction_id
             where tl.user_id = $1
             group by tl.label_id
           )
           select l.id, l.name, l.normalized_name
           from labels l
           join recently_used ru on ru.label_id = l.id
           where ${filters.join(' and ')}
           order by ru.last_used_at desc, l.normalized_name asc, l.id asc
           limit $${values.length}`,
          values,
        )
        return { items: result.rows.map(toLabel), nextCursor: null }
      }

      const decodedCursor = cursor ? decodeCursor(cursor) : null
      const values: unknown[] = [userId]
      const filters = ['user_id = $1']

      if (query) {
        values.push(`%${query}%`)
        filters.push(`normalized_name like $${values.length}`)
      }

      if (decodedCursor) {
        values.push(decodedCursor.name, decodedCursor.id)
        filters.push(`(normalized_name, id) > ($${values.length - 1}, $${values.length}::uuid)`)
      }

      values.push(limit + 1)
      const result = await pool.query<LabelRow>(
        `select id, name, normalized_name
         from labels
         where ${filters.join(' and ')}
         order by normalized_name asc, id asc
         limit $${values.length}`,
        values,
      )
      const rows = result.rows.slice(0, limit)
      const last = rows.at(-1)

      return {
        items: rows.map(toLabel),
        nextCursor: result.rows.length > limit && last ? encodeCursor({ name: last.normalized_name, id: last.id }) : null,
      }
    },

    async createLabel(userId, name) {
      const result = await pool.query<LabelRow>(
        `insert into labels (user_id, name)
         values ($1, $2)
         returning id, name, normalized_name`,
        [userId, name],
      )
      return toLabel(result.rows[0])
    },

    async updateLabel(userId, labelId, name) {
      const result = await pool.query<LabelRow>(
        `update labels
         set name = $3
         where user_id = $1 and id = $2
         returning id, name, normalized_name`,
        [userId, labelId, name],
      )
      return result.rows[0] ? toLabel(result.rows[0]) : null
    },

    async deleteLabel(userId, labelId) {
      const result = await pool.query(
        `delete from labels where user_id = $1 and id = $2 returning id`,
        [userId, labelId],
      )
      return Boolean(result.rows[0])
    },
  }
}

async function withTransaction<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await callback(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

async function updateSortOrder(client: PoolClient, table: 'wallets' | 'categories', userId: string, ids: string[]) {
  for (const [sortOrder, id] of ids.entries()) {
    await client.query(
      `update ${table} set sort_order = $3 where user_id = $1 and id = $2`,
      [userId, id, sortOrder],
    )
  }
}

function assertExactIds(currentIds: string[], requestedIds: string[], entityName: string) {
  const expected = [...currentIds].sort()
  const received = [...requestedIds].sort()
  if (expected.length !== received.length || expected.some((id, index) => id !== received[index])) {
    throw new DomainError(409, `Pořadí ${entityName} neodpovídá aktuálním datům.`)
  }
}

function encodeCursor(cursor: LabelCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(cursor: string): LabelCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<LabelCursor>
    if (typeof parsed.name === 'string' && typeof parsed.id === 'string') return { name: parsed.name, id: parsed.id }
  } catch {
    // The generic validation error below intentionally does not expose parser details.
  }

  throw new DomainError(400, 'Kurzór štítků není platný.')
}
