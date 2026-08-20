import { timingSafeEqual } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import type { RecurringRuleRepository } from '../recurring/repository.js'
import { getPragueToday } from '../recurring/schedule.js'

export function createRecurringJobRoutes(repository: RecurringRuleRepository, secret: string): FastifyPluginAsync {
  return async function recurringJobRoutes(app) {
    app.post('/internal/jobs/recurring', { preHandler: requireJobSecret(secret) }, async () => {
      return repository.generateDue(getPragueToday())
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

function safeEqual(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
}
