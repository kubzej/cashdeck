import { expect, type Page, type Route } from '@playwright/test'
import type { RecurringRule, RecurringRuleInput } from '../../src/features/recurring/api'

export type RecurringRulesApiMock = {
  failNext: (method: RecurringRequestMethod, failure?: Partial<RecurringApiFailure>) => void
  rules: () => RecurringRule[]
}

type RecurringRequestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'
type RecurringApiFailure = { status: number; message: string }
type QueuedRecurringApiFailure = RecurringApiFailure & { remaining: number }

export async function mockRecurringRulesApi(page: Page, initialRules: RecurringRule[] = []) {
  let rules = initialRules.map(cloneRule)
  let nextId = rules.length + 1
  const failures = new Map<RecurringRequestMethod, QueuedRecurringApiFailure>()

  await page.route('http://api.test/api/recurring-rules**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')

    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (await fulfillFailure(route, failures)) return

    if (request.method() === 'GET' && pathname === '/api/recurring-rules') {
      await route.fulfill(json(rules))
      return
    }

    if (request.method() === 'POST' && pathname === '/api/recurring-rules') {
      const input = request.postDataJSON() as RecurringRuleInput
      const rule = fromInput(`recurring-rule-${nextId++}`, input)
      rules = [...rules, rule]
      await route.fulfill(json(rule, 201))
      return
    }

    if (request.method() === 'PATCH') {
      const ruleId = pathname.split('/').at(-1)
      const input = request.postDataJSON() as RecurringRuleInput
      const existing = rules.find((rule) => rule.id === ruleId)
      if (!existing) {
        await route.fulfill(json({ message: 'Opakování neexistuje.' }, 404))
        return
      }
      const rule = { ...fromInput(existing.id, input), status: 'active' as const }
      rules = rules.map((item) => item.id === ruleId ? rule : item)
      await route.fulfill(json(rule))
      return
    }

    if (request.method() === 'DELETE') {
      const ruleId = pathname.split('/').at(-1)
      rules = rules.filter((rule) => rule.id !== ruleId)
      await route.fulfill({ status: 204 })
      return
    }

    await route.fulfill(json({ message: `Nepodporovaný recurring požadavek: ${request.method()} ${pathname}` }, 500))
  })

  return {
    failNext(method, failure = {}) {
      failures.set(method, {
        remaining: 1,
        status: failure.status ?? 500,
        message: failure.message ?? 'Požadavek se nepodařilo dokončit.',
      })
    },
    rules: () => rules.map(cloneRule),
  } satisfies RecurringRulesApiMock
}

function fromInput(id: string, input: RecurringRuleInput): RecurringRule {
  const isTransaction = input.kind === 'transaction'
  return {
    id,
    name: input.name,
    kind: input.kind,
    amountCzk: input.amountCzk,
    walletId: input.walletId ?? null,
    walletName: input.walletId ?? null,
    categoryId: input.categoryId ?? null,
    categoryName: input.categoryId ?? null,
    categoryIconKey: isTransaction ? 'tags' : null,
    categoryColorKey: isTransaction ? 'teal' : null,
    categoryDirection: isTransaction ? 'expense' : null,
    sourceWalletId: input.sourceWalletId ?? null,
    sourceWalletName: input.sourceWalletId ?? null,
    destinationWalletId: input.destinationWalletId ?? null,
    destinationWalletName: input.destinationWalletId ?? null,
    note: input.note,
    labels: input.labelIds.map((id) => ({ id, name: id })),
    frequency: input.frequency,
    customIntervalDays: input.customIntervalDays,
    nextOccurrenceDate: input.nextOccurrenceDate,
    endsOn: input.endsOn,
    status: 'active',
  }
}

function cloneRule(rule: RecurringRule): RecurringRule {
  return { ...rule, labels: rule.labels.map((label) => ({ ...label })) }
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

async function fulfillFailure(route: Route, failures: Map<RecurringRequestMethod, QueuedRecurringApiFailure>) {
  const method = route.request().method() as RecurringRequestMethod
  const failure = failures.get(method)
  if (!failure) return false

  failures.delete(method)
  await route.fulfill(json({ message: failure.message }, failure.status))
  return true
}
