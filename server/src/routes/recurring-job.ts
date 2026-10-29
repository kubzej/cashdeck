import type { FastifyPluginAsync } from 'fastify'
import type { RecurringRuleRepository } from '../recurring/repository.js'
import { getPragueToday } from '../recurring/schedule.js'
import { safeEqual } from '../security.js'

export function createRecurringJobRoutes(repository: RecurringRuleRepository, secret: string): FastifyPluginAsync {
  return async function recurringJobRoutes(app) {
    app.post('/internal/jobs/recurring', { preHandler: requireJobSecret(secret) }, async (request, reply) => {
      const result = await repository.generateDue(getPragueToday())
      if (result.failures.length > 0) {
        request.log.error({ failures: result.failures }, 'Some recurring rules failed to generate their due occurrences')
        // A non-2xx status is what lets the scheduler mark the run as failed; the body still
        // reports what did get generated.
        return reply.code(500).send(result)
      }
      return result
    })
  }
}

function requireJobSecret(secret: string) {
  return async function (request: { headers: Record<string, string | string[] | undefined> }, reply: { code: (statusCode: number) => { send: (body: { error: string }) => unknown } }) {
    const provided = request.headers['x-cashdeck-job-secret']
    if (typeof provided !== 'string' || !safeEqual(secret, provided)) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  }
}
