import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import { parseIndependenceSettingsInput, parseIrregularExpenseInput, parseIrregularExpenseUpdateInput } from '../independence/domain.js'
import type { IndependenceRepository } from '../independence/repository.js'
import { DomainError, parseUuid } from '../management/domain.js'

export function createIndependenceRoutes(repository: IndependenceRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function independenceRoutes(app) {
    app.get('/api/independence/settings', { preHandler: requireAuth }, async (request) => {
      const settings = await repository.getSettings(request.authUser.id)
      return { settings }
    })

    app.put('/api/independence/settings', { preHandler: requireAuth }, async (request) => {
      const settings = await repository.upsertSettings(request.authUser.id, parseIndependenceSettingsInput(request.body))
      return { settings }
    })

    app.get('/api/independence/irregular-expenses', { preHandler: requireAuth }, async (request) => {
      return { items: await repository.listIrregularExpenses(request.authUser.id) }
    })

    app.post('/api/independence/irregular-expenses', { preHandler: requireAuth }, async (request, reply) => {
      const item = await repository.createIrregularExpense(request.authUser.id, parseIrregularExpenseInput(request.body))
      return reply.code(201).send(item)
    })

    app.patch('/api/independence/irregular-expenses/:id', { preHandler: requireAuth }, async (request) => {
      const id = parseUuid((request.params as Record<string, unknown>).id, 'ID položky')
      const item = await repository.updateIrregularExpense(request.authUser.id, id, parseIrregularExpenseUpdateInput(request.body))
      if (!item) throw new DomainError(404, 'Položka neexistuje.')
      return item
    })

    app.delete('/api/independence/irregular-expenses/:id', { preHandler: requireAuth }, async (request, reply) => {
      const id = parseUuid((request.params as Record<string, unknown>).id, 'ID položky')
      const deleted = await repository.deleteIrregularExpense(request.authUser.id, id)
      if (!deleted) throw new DomainError(404, 'Položka neexistuje.')
      return reply.code(204).send()
    })

    app.get('/api/independence/progress', { preHandler: requireAuth }, async (request) => repository.getProgress(request.authUser.id))

    app.get('/api/independence/wealth-series', { preHandler: requireAuth }, async (request) => ({ points: await repository.getWealthSeries(request.authUser.id) }))
  }
}
