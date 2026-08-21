import type { Pool, PoolClient } from 'pg'
import { DomainError } from '../management/domain.js'
import type { TransactionInput, TransactionUpdateInput } from './domain.js'

export type TransactionLabel = {
  id: string
  name: string
}

export type Transaction = {
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
  labels: TransactionLabel[]
}

export type TransactionRepository = {
  createTransaction(userId: string, input: TransactionInput): Promise<Transaction>
  updateTransaction(userId: string, transactionId: string, input: TransactionUpdateInput): Promise<Transaction | null>
  deleteTransaction(userId: string, transactionId: string): Promise<boolean>
}

type TransactionRow = {
  id: string
  wallet_id: string
  wallet_name: string
  category_id: string
  category_name: string
  category_icon_key: string
  category_color_key: string
  direction: 'income' | 'expense'
  amount_czk: string
  transaction_date: string
  note: string | null
  created_at: Date
  labels: unknown
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>

export function createTransactionRepository(pool: Pool): TransactionRepository {
  return {
    async createTransaction(userId, input) {
      return withTransaction(pool, async (client) => {
        const created = await client.query<{ id: string }>(
          `insert into transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
           values ($1, $2, $3, $4, $5, $6)
           returning id`,
          [userId, input.walletId, input.categoryId, input.amountCzk, input.transactionDate, input.note],
        )
        const transactionId = created.rows[0]?.id
        if (!transactionId) throw new Error('Vytvoření transakce nevrátilo ID.')
        await replaceTransactionLabels(client, userId, transactionId, input.labelIds)
        return requireTransaction(client, userId, transactionId)
      })
    },

    async updateTransaction(userId, transactionId, input) {
      return withTransaction(pool, async (client) => {
        const assignments: string[] = []
        const values: unknown[] = [userId, transactionId]
        const add = (column: string, value: unknown) => {
          values.push(value)
          assignments.push(`${column} = $${values.length}`)
        }
        if (input.walletId !== undefined) add('wallet_id', input.walletId)
        if (input.categoryId !== undefined) add('category_id', input.categoryId)
        if (input.amountCzk !== undefined) add('amount_czk', input.amountCzk)
        if (input.transactionDate !== undefined) add('transaction_date', input.transactionDate)
        if (input.note !== undefined) add('note', input.note)

        if (assignments.length > 0) {
          const updated = await client.query<{ id: string }>(
            `update transactions
             set ${assignments.join(', ')}
             where user_id = $1 and id = $2
             returning id`,
            values,
          )
          if (!updated.rows[0]) return null
        } else if (!await transactionExists(client, userId, transactionId)) {
          return null
        }

        if (input.labelIds !== undefined) await replaceTransactionLabels(client, userId, transactionId, input.labelIds)
        return requireTransaction(client, userId, transactionId)
      })
    },

    async deleteTransaction(userId, transactionId) {
      const result = await pool.query(
        `delete from transactions where user_id = $1 and id = $2 returning id`,
        [userId, transactionId],
      )
      return Boolean(result.rows[0])
    },
  }
}

function transactionSelect(filters: string, limit: string) {
  return `with page as (
    select t.id, t.wallet_id, t.category_id, t.amount_czk,
      to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
      t.note, t.created_at
    from transactions t
    where ${filters}
    order by t.transaction_date desc, t.created_at desc, t.id desc
    limit ${limit}
  )
  select page.id, page.wallet_id, w.name as wallet_name, page.category_id,
    c.name as category_name, c.icon_key as category_icon_key, c.color_key as category_color_key,
    c.direction, page.amount_czk, page.transaction_date,
    page.note, page.created_at,
    coalesce(
      json_agg(json_build_object('id', l.id, 'name', l.name) order by l.normalized_name asc, l.id asc)
      filter (where l.id is not null),
      '[]'::json
    ) as labels
  from page
  join wallets w on w.user_id = $1 and w.id = page.wallet_id
  join categories c on c.user_id = $1 and c.id = page.category_id
  left join transaction_labels tl on tl.user_id = $1 and tl.transaction_id = page.id
  left join labels l on l.user_id = $1 and l.id = tl.label_id
  group by page.id, page.wallet_id, w.name, page.category_id, c.name, c.icon_key, c.color_key, c.direction,
    page.amount_czk, page.transaction_date, page.note, page.created_at
  order by page.transaction_date desc, page.created_at desc, page.id desc`
}

async function requireTransaction(queryable: Queryable, userId: string, transactionId: string) {
  const result = await queryable.query<TransactionRow>(
    transactionSelect('t.user_id = $1 and t.id = $2::uuid', '1'),
    [userId, transactionId],
  )
  const transaction = result.rows[0]
  if (!transaction) throw new Error('Transakce nebyla po uložení nalezena.')
  return toTransaction(transaction)
}

async function transactionExists(queryable: Queryable, userId: string, transactionId: string) {
  const result = await queryable.query<{ exists: boolean }>(
    `select exists(select 1 from transactions where user_id = $1 and id = $2::uuid) as exists`,
    [userId, transactionId],
  )
  return result.rows[0]?.exists ?? false
}

async function replaceTransactionLabels(client: PoolClient, userId: string, transactionId: string, labelIds: string[]) {
  if (labelIds.length > 0) {
    const result = await client.query<{ id: string }>(
      `select id from labels where user_id = $1 and id = any($2::uuid[])`,
      [userId, labelIds],
    )
    if (result.rows.length !== labelIds.length) throw new DomainError(404, 'Jeden nebo více štítků neexistuje.')
  }

  await client.query(
    `delete from transaction_labels where user_id = $1 and transaction_id = $2`,
    [userId, transactionId],
  )
  if (labelIds.length === 0) return

  await client.query(
    `insert into transaction_labels (user_id, transaction_id, label_id)
     select $1, $2, unnest($3::uuid[])`,
    [userId, transactionId, labelIds],
  )
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    walletId: row.wallet_id,
    walletName: row.wallet_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIconKey: row.category_icon_key,
    categoryColorKey: row.category_color_key,
    direction: row.direction,
    amountCzk: Number(row.amount_czk),
    transactionDate: row.transaction_date,
    note: row.note,
    labels: parseLabels(row.labels),
  }
}

function parseLabels(value: unknown): TransactionLabel[] {
  const labels = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(labels)) return []
  return labels.filter((label): label is TransactionLabel => typeof label === 'object' && label !== null && 'id' in label && 'name' in label && typeof label.id === 'string' && typeof label.name === 'string')
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
