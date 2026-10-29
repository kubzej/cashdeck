import type { FastifyRequest } from 'fastify'
import type { Writable } from 'node:stream'

// Fastify's default request log carries the full URL, and the query string holds search text
// (merchants, notes, label names) that should not sit in the log store. Everything else the
// default serializer reports is kept.
export function serializeRequest(request: FastifyRequest) {
  return {
    method: request.method,
    url: request.url.split('?')[0],
    host: request.host,
    remoteAddress: request.ip,
    remotePort: request.socket?.remotePort,
  }
}

export function createLoggerOptions(stream?: Writable) {
  return { serializers: { req: serializeRequest }, ...(stream ? { stream } : {}) }
}
