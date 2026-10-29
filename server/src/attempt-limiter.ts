type Window = { count: number; resetsAt: number }

export type AttemptLimit = { maxFailures: number; windowMs: number }

export type AttemptLimiterOptions = {
  perClient: AttemptLimit
  global: AttemptLimit
  now?: () => number
}

/**
 * Fixed-window counter of failed attempts, tracked per client and across all clients. The
 * global window is the real brute-force cap: per-client limits alone are bypassed by rotating
 * IPs, and a global lockout costs little in a single-user app whose devices already hold
 * long-lived tokens.
 */
export function createAttemptLimiter({ perClient, global, now = Date.now }: AttemptLimiterOptions) {
  const clients = new Map<string, Window>()
  let globalWindow: Window = { count: 0, resetsAt: 0 }

  function current(window: Window | undefined, limit: AttemptLimit, at: number): Window {
    return window && window.resetsAt > at ? window : { count: 0, resetsAt: at + limit.windowMs }
  }

  function pruneExpired(at: number) {
    for (const [key, window] of clients) {
      if (window.resetsAt <= at) clients.delete(key)
    }
  }

  return {
    /** Returns the number of seconds until the caller may retry, or `null` when allowed. */
    retryAfterSeconds(clientKey: string): number | null {
      const at = now()
      const globalCurrent = current(globalWindow, global, at)
      const clientCurrent = current(clients.get(clientKey), perClient, at)
      const blockedUntil = Math.max(
        globalCurrent.count >= global.maxFailures ? globalCurrent.resetsAt : 0,
        clientCurrent.count >= perClient.maxFailures ? clientCurrent.resetsAt : 0,
      )
      return blockedUntil > at ? Math.ceil((blockedUntil - at) / 1000) : null
    },

    recordFailure(clientKey: string) {
      const at = now()
      pruneExpired(at)
      globalWindow = current(globalWindow, global, at)
      globalWindow.count += 1
      const clientWindow = current(clients.get(clientKey), perClient, at)
      clientWindow.count += 1
      clients.set(clientKey, clientWindow)
    },

    recordSuccess(clientKey: string) {
      clients.delete(clientKey)
    },
  }
}

export type AttemptLimiter = ReturnType<typeof createAttemptLimiter>
