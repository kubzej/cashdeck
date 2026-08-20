import { Buffer } from 'node:buffer'
import type { Pool, PoolClient } from 'pg'
import { defaultCategorySeeds, type CategoryDirection, type CategoryIconKey, type ColorKey, DomainError } from './domain.js'

export type Wallet = {
  id: string
  name: string
  colorKey: string
  openingBalanceCzk: number
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

export type CreateWalletInput = {
  name: string
  colorKey: ColorKey
  openingBalanceCzk: number
  openingBalanceDate: string
}

export type UpdateWalletInput = Partial<CreateWalletInput> & {
  isHidden?: boolean
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
  bootstrap(userId: string): Promise<{ seeded: boolean }>
  listWallets(userId: string, includeHidden: boolean): Promise<Wallet[]>
  getWallet(userId: string, walletId: string): Promise<Wallet | null>
  createWallet(userId: string, input: CreateWalletInput): Promise<Wallet>
  updateWallet(userId: string, walletId: string, input: UpdateWalletInput): Promise<Wallet | null>
  reorderWallets(userId: string, walletIds: string[]): Promise<void>
  deleteWallet(userId: string, walletId: string): Promise<boolean>
  listCategories(userId: string): Promise<Category[]>
  createCategory(userId: string, input: CreateCategoryInput): Promise<Category>
  updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput): Promise<Category | null>
  reorderCategories(userId: string, direction: CategoryDirection, categoryIds: string[]): Promise<void>
  deleteCategory(userId: string, categoryId: string): Promise<boolean>
  listLabels(userId: string, query: string | null, cursor: string | null, limit: number): Promise<LabelPage>
  createLabel(userId: string, name: string): Promise<Label>
  updateLabel(userId: string, labelId: string, name: string): Promise<Label | null>
  deleteLabel(userId: string, labelId: string): Promise<boolean>
}

type WalletRow = {
  id: string
  name: string
  color_key: string
  opening_balance_czk: string
  opening_balance_date: string
  sort_order: number
  is_hidden: boolean
  opening_balance_locked: boolean
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
  select
    w.id,
    w.name,
    w.color_key,
    w.opening_balance_czk,
    w.opening_balance_date,
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
`

function toWallet(row: WalletRow): Wallet {
  return {
    id: row.id,
    name: row.name,
    colorKey: row.color_key,
    openingBalanceCzk: Number(row.opening_balance_czk),
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
    async bootstrap(userId) {
      return withTransaction(pool, async (client) => {
        await client.query(
          `insert into user_settings (user_id)
           values ($1)
           on conflict (user_id) do nothing`,
          [userId],
        )

        const settings = await client.query<{ default_categories_seeded_at: Date | null }>(
          `select default_categories_seeded_at
           from user_settings
           where user_id = $1
           for update`,
          [userId],
        )

        if (settings.rows[0]?.default_categories_seeded_at) {
          return { seeded: false }
        }

        for (const category of defaultCategorySeeds()) {
          await client.query(
            `insert into categories (user_id, name, direction, icon_key, color_key, sort_order)
             values ($1, $2, $3, $4, $5, $6)
             on conflict (user_id, direction, normalized_name) do nothing`,
            [userId, category.name, category.direction, category.iconKey, category.colorKey, category.sortOrder],
          )
        }

        await client.query(
          `update user_settings
           set default_categories_seeded_at = now()
           where user_id = $1`,
          [userId],
        )

        return { seeded: true }
      })
    },

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
         insert into wallets (user_id, name, color_key, opening_balance_czk, opening_balance_date, sort_order)
         select $1, $2, $3, $4, $5, next_order.sort_order
         from next_order
         returning id, name, color_key, opening_balance_czk, opening_balance_date, sort_order, is_hidden, false as opening_balance_locked`,
        [userId, input.name, input.colorKey, input.openingBalanceCzk, input.openingBalanceDate],
      )

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
      return Boolean(result.rows[0])
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

    async listLabels(userId, query, cursor, limit) {
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
