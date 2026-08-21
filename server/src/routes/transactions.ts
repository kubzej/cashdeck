import type { FastifyPluginAsync } from 'fastify'
import type { AuthGuard } from '../auth.js'
import { DomainError, parseUuid } from '../management/domain.js'
import {
  parseCreateTransaction,
  parseUpdateTransaction,
} from '../transactions/domain.js'
import type { TransactionRepository } from '../transactions/repository.js'

export function createTransactionRoutes(repository: TransactionRepository, requireAuth: AuthGuard): FastifyPluginAsync {
  return async function transactionRoutes(app) {
    app.post('/api/transactions', { preHandler: requireAuth }, async (request, reply) => {
      const transaction = await repository.createTransaction(request.authUser.id, parseCreateTransaction(request.body))
      return reply.code(201).send(transaction)
    })

    app.patch('/api/transactions/:transactionId', { preHandler: requireAuth }, async (request) => {
      const transactionId = parseUuid((request.params as Record<string, unknown>).transactionId, 'ID transakce')
      const transaction = await repository.updateTransaction(request.authUser.id, transactionId, parseUpdateTransaction(request.body))
      if (!transaction) throw new DomainError(404, 'Transakce neexistuje.')
      return transaction
    })

    app.delete('/api/transactions/:transactionId', { preHandler: requireAuth }, async (request, reply) => {
      const transactionId = parseUuid((request.params as Record<string, unknown>).transactionId, 'ID transakce')
      const deleted = await repository.deleteTransaction(request.authUser.id, transactionId)
      if (!deleted) throw new DomainError(404, 'Transakce neexistuje.')
      return reply.code(204).send()
    })
  }
}
