import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import { DomainError, parseUuid } from '../management/domain.js'
import { parseCreateTransfer, parseTransferListQuery, parseUpdateTransfer } from '../transfers/domain.js'
import type { TransferRepository } from '../transfers/repository.js'

export function createTransferRoutes(repository: TransferRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function transferRoutes(app) {
    app.get('/api/transfers', { preHandler: requireAuth }, async (request) => repository.listTransfers(request.authUser.id, parseTransferListQuery(request.query)))

    app.post('/api/transfers', { preHandler: requireAuth }, async (request, reply) => {
      const transfer = await repository.createTransfer(request.authUser.id, parseCreateTransfer(request.body))
      return reply.code(201).send(transfer)
    })

    app.patch('/api/transfers/:transferId', { preHandler: requireAuth }, async (request) => {
      const transferId = parseUuid((request.params as Record<string, unknown>).transferId, 'ID převodu')
      const transfer = await repository.updateTransfer(request.authUser.id, transferId, parseUpdateTransfer(request.body))
      if (!transfer) throw new DomainError(404, 'Převod neexistuje.')
      return transfer
    })

    app.delete('/api/transfers/:transferId', { preHandler: requireAuth }, async (request, reply) => {
      const transferId = parseUuid((request.params as Record<string, unknown>).transferId, 'ID převodu')
      const deleted = await repository.deleteTransfer(request.authUser.id, transferId)
      if (!deleted) throw new DomainError(404, 'Převod neexistuje.')
      return reply.code(204).send()
    })
  }
}
