import { Buffer } from 'node:buffer'
import type { Pool, PoolClient } from 'pg'
import { DomainError } from '../management/domain.js'
import { assertDifferentWallets, type TransferInput, type TransferListInput, type TransferUpdateInput } from './domain.js'

export type TransferLabel = { id: string; name: string }

export type Transfer = {
  id: string
  sourceWalletId: string
  sourceWalletName: string
  destinationWalletId: string
  destinationWalletName: string
  amountCzk: number
  transferDate: string
  note: string | null
  labels: TransferLabel[]
}

export type TransferPage = { items: Transfer[]; nextCursor: string | null }

export type TransferRepository = {
  listTransfers(userId: string, input: TransferListInput): Promise<TransferPage>
  createTransfer(userId: string, input: TransferInput): Promise<Transfer>
  updateTransfer(userId: string, transferId: string, input: TransferUpdateInput): Promise<Transfer | null>
  deleteTransfer(userId: string, transferId: string): Promise<boolean>
}

type TransferCursor = { transferDate: string; createdAt: string; id: string }
type TransferRow = {
  id: string
  source_wallet_id: string
  source_wallet_name: string
  destination_wallet_id: string
  destination_wallet_name: string
  amount_czk: string
  transfer_date: string
  note: string | null
  created_at: Date
  labels: unknown
}
type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>

export function createTransferRepository(pool: Pool): TransferRepository {
  return {
    async listTransfers(userId, input) {
      const cursor = input.cursor ? decodeCursor(input.cursor) : null
      const values: unknown[] = [userId]
      const filters = ['tr.user_id = $1']
      if (input.walletId) {
        values.push(input.walletId)
        filters.push(`(tr.source_wallet_id = $${values.length}::uuid or tr.destination_wallet_id = $${values.length}::uuid)`)
      }
      if (input.dateFrom) {
        values.push(input.dateFrom)
        filters.push(`tr.transfer_date >= $${values.length}::date`)
      }
      if (input.dateTo) {
        values.push(input.dateTo)
        filters.push(`tr.transfer_date <= $${values.length}::date`)
      }
      if (cursor) {
        values.push(cursor.transferDate, cursor.createdAt, cursor.id)
        filters.push(`(tr.transfer_date, tr.created_at, tr.id) < ($${values.length - 2}::date, $${values.length - 1}::timestamptz, $${values.length}::uuid)`)
      }
      values.push(input.limit + 1)

      const result = await pool.query<TransferRow>(transferSelect(filters.join(' and '), `$${values.length}`, true), values)
      const rows = result.rows.slice(0, input.limit)
      const last = rows.at(-1)
      return { items: rows.map(toTransfer), nextCursor: result.rows.length > input.limit && last ? encodeCursor(last) : null }
    },

    async createTransfer(userId, input) {
      return withTransaction(pool, async (client) => {
        const created = await client.query<{ id: string }>(
          `insert into transfers (user_id, source_wallet_id, destination_wallet_id, amount_czk, transfer_date, note)
           values ($1, $2, $3, $4, $5, $6)
           returning id`,
          [userId, input.sourceWalletId, input.destinationWalletId, input.amountCzk, input.transferDate, input.note],
        )
        const transferId = created.rows[0]?.id
        if (!transferId) throw new Error('Vytvoření převodu nevrátilo ID.')
        await replaceTransferLabels(client, userId, transferId, input.labelIds)
        return requireTransfer(client, userId, transferId)
      })
    },

    async updateTransfer(userId, transferId, input) {
      return withTransaction(pool, async (client) => {
        const existing = await client.query<{ source_wallet_id: string; destination_wallet_id: string }>(
          `select source_wallet_id, destination_wallet_id
           from transfers
           where user_id = $1 and id = $2
           for update`,
          [userId, transferId],
        )
        const current = existing.rows[0]
        if (!current) return null
        assertDifferentWallets(input.sourceWalletId ?? current.source_wallet_id, input.destinationWalletId ?? current.destination_wallet_id)

        const assignments: string[] = []
        const values: unknown[] = [userId, transferId]
        const add = (column: string, value: unknown) => {
          values.push(value)
          assignments.push(`${column} = $${values.length}`)
        }
        if (input.sourceWalletId !== undefined) add('source_wallet_id', input.sourceWalletId)
        if (input.destinationWalletId !== undefined) add('destination_wallet_id', input.destinationWalletId)
        if (input.amountCzk !== undefined) add('amount_czk', input.amountCzk)
        if (input.transferDate !== undefined) add('transfer_date', input.transferDate)
        if (input.note !== undefined) add('note', input.note)

        if (assignments.length > 0) {
          await client.query(
            `update transfers
             set ${assignments.join(', ')}
             where user_id = $1 and id = $2`,
            values,
          )
        }
        if (input.labelIds !== undefined) await replaceTransferLabels(client, userId, transferId, input.labelIds)
        return requireTransfer(client, userId, transferId)
      })
    },

    async deleteTransfer(userId, transferId) {
      const result = await pool.query(`delete from transfers where user_id = $1 and id = $2 returning id`, [userId, transferId])
      return Boolean(result.rows[0])
    },
  }
}

function transferSelect(filters: string, limit: string, excludeHiddenWallets = false) {
  const hiddenFilter = excludeHiddenWallets
    ? `
      and not source_wallet_filter.is_hidden
      and not destination_wallet_filter.is_hidden`
    : ''
  return `with page as (
    select tr.id, tr.source_wallet_id, tr.destination_wallet_id, tr.amount_czk,
      to_char(tr.transfer_date, 'YYYY-MM-DD') as transfer_date,
      tr.note, tr.created_at
    from transfers tr
    join wallets source_wallet_filter on source_wallet_filter.user_id = tr.user_id and source_wallet_filter.id = tr.source_wallet_id
    join wallets destination_wallet_filter on destination_wallet_filter.user_id = tr.user_id and destination_wallet_filter.id = tr.destination_wallet_id
    where ${filters}${hiddenFilter}
    order by tr.transfer_date desc, tr.created_at desc, tr.id desc
    limit ${limit}
  )
  select page.id, page.source_wallet_id, source.name as source_wallet_name,
    page.destination_wallet_id, destination.name as destination_wallet_name,
    page.amount_czk, page.transfer_date, page.note, page.created_at,
    coalesce(
      json_agg(json_build_object('id', l.id, 'name', l.name) order by l.normalized_name asc, l.id asc)
      filter (where l.id is not null),
      '[]'::json
    ) as labels
  from page
  join wallets source on source.user_id = $1 and source.id = page.source_wallet_id
  join wallets destination on destination.user_id = $1 and destination.id = page.destination_wallet_id
  left join transfer_labels tl on tl.user_id = $1 and tl.transfer_id = page.id
  left join labels l on l.user_id = $1 and l.id = tl.label_id
  group by page.id, page.source_wallet_id, source.name, page.destination_wallet_id, destination.name,
    page.amount_czk, page.transfer_date, page.note, page.created_at
  order by page.transfer_date desc, page.created_at desc, page.id desc`
}

async function requireTransfer(queryable: Queryable, userId: string, transferId: string) {
  const result = await queryable.query<TransferRow>(transferSelect('tr.user_id = $1 and tr.id = $2::uuid', '1'), [userId, transferId])
  const transfer = result.rows[0]
  if (!transfer) throw new Error('Převod nebyl po uložení nalezen.')
  return toTransfer(transfer)
}

async function replaceTransferLabels(client: PoolClient, userId: string, transferId: string, labelIds: string[]) {
  if (labelIds.length > 0) {
    const result = await client.query<{ id: string }>(`select id from labels where user_id = $1 and id = any($2::uuid[])`, [userId, labelIds])
    if (result.rows.length !== labelIds.length) throw new DomainError(404, 'Jeden nebo více štítků neexistuje.')
  }
  await client.query(`delete from transfer_labels where user_id = $1 and transfer_id = $2`, [userId, transferId])
  if (labelIds.length === 0) return
  await client.query(
    `insert into transfer_labels (user_id, transfer_id, label_id)
     select $1, $2, unnest($3::uuid[])`,
    [userId, transferId, labelIds],
  )
}

function toTransfer(row: TransferRow): Transfer {
  return {
    id: row.id,
    sourceWalletId: row.source_wallet_id,
    sourceWalletName: row.source_wallet_name,
    destinationWalletId: row.destination_wallet_id,
    destinationWalletName: row.destination_wallet_name,
    amountCzk: Number(row.amount_czk),
    transferDate: row.transfer_date,
    note: row.note,
    labels: parseLabels(row.labels),
  }
}

function parseLabels(value: unknown): TransferLabel[] {
  const labels = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(labels)) return []
  return labels.filter((label): label is TransferLabel => typeof label === 'object' && label !== null && 'id' in label && 'name' in label && typeof label.id === 'string' && typeof label.name === 'string')
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

function encodeCursor(row: TransferRow) {
  return Buffer.from(JSON.stringify({ transferDate: row.transfer_date, createdAt: row.created_at.toISOString(), id: row.id } satisfies TransferCursor)).toString('base64url')
}

function decodeCursor(cursor: string): TransferCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<TransferCursor>
    if (typeof parsed.transferDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.transferDate) && typeof parsed.createdAt === 'string' && !Number.isNaN(new Date(parsed.createdAt).valueOf()) && typeof parsed.id === 'string' && /^[0-9a-f-]{36}$/i.test(parsed.id)) return parsed as TransferCursor
  } catch {
    // The generic validation error below intentionally does not expose parser details.
  }
  throw new DomainError(400, 'Kurzór převodů není platný.')
}
