import type { Pool } from 'pg'
import { expect, test, vi } from 'vitest'
import { createIndependenceRepository } from '../independence/repository.js'
import { createOverviewRepository } from '../overview/repository.js'
import { resetWealthCacheForTests } from '../wealth-cache.js'
import { financialEventsCte } from './financial-events.js'

const normalize = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim()

test('Overview and Independence derive wealth from the very same financial_events definition', async () => {
  resetWealthCacheForTests()
  const overviewQuery = vi.fn().mockResolvedValue({ rows: [{ earliest_activity_date: '2020-01-01' }] })
  const independenceQuery = vi.fn().mockResolvedValue({ rows: [] })

  await createOverviewRepository({ query: overviewQuery } as unknown as Pool).getOverview('user-1', { walletIds: null, period: 'month', dateFrom: '2026-08-01', dateTo: '2026-08-21', search: null }).catch(() => {})
  await createIndependenceRepository({ query: independenceQuery } as unknown as Pool).getWealthSeries('user-1')

  const shared = normalize(financialEventsCte)
  const overviewWealthSql = overviewQuery.mock.calls.map(([sql]) => normalize(sql)).find((sql) => sql.includes('financial_events as materialized'))
  expect(overviewWealthSql).toContain(shared)
  expect(normalize(independenceQuery.mock.calls[0][0])).toContain(shared)
})
