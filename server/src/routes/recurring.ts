import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import { DomainError, parseUuid } from '../management/domain.js'
import { assertForwardSchedule, parseRecurringRule } from '../recurring/domain.js'
import type { RecurringRuleRepository } from '../recurring/repository.js'
import { getPragueToday } from '../recurring/schedule.js'

export function createRecurringRuleRoutes(repository: RecurringRuleRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function recurringRuleRoutes(app) {
    app.get('/api/recurring-rules', { preHandler: requireAuth }, async (request) => repository.listRules(request.authUser.id))

    app.post('/api/recurring-rules', { preHandler: requireAuth }, async (request, reply) => {
      const today = getPragueToday()
      const input = parseRecurringRule(request.body, today)
      assertForwardSchedule(input.nextOccurrenceDate, input.endsOn, today)
      const rule = await repository.createRule(request.authUser.id, input, today)
      return reply.code(201).send(rule)
    })

    app.patch('/api/recurring-rules/:ruleId', { preHandler: requireAuth }, async (request) => {
      const ruleId = parseUuid((request.params as Record<string, unknown>).ruleId, 'ID opakování')
      const today = getPragueToday()
      const rule = await repository.updateRule(request.authUser.id, ruleId, parseRecurringRule(request.body, today), today)
      if (!rule) throw new DomainError(404, 'Opakování neexistuje.')
      return rule
    })

    app.delete('/api/recurring-rules/:ruleId', { preHandler: requireAuth }, async (request, reply) => {
      const ruleId = parseUuid((request.params as Record<string, unknown>).ruleId, 'ID opakování')
      const deleted = await repository.deleteRule(request.authUser.id, ruleId)
      if (!deleted) throw new DomainError(404, 'Opakování neexistuje.')
      return reply.code(204).send()
    })
  }
}
