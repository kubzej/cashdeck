import type { Route } from '@playwright/test'

export const testToken = 'token-1'

/**
 * Answers 401 when a mocked API request lacks the session token and returns true, so the handler
 * can stop. Asserting inside a route handler would only throw in a callback, leaving the request
 * hanging until the test times out; a 401 signs the app out and the test fails on what it expects.
 */
export async function rejectUnauthorized(route: Route) {
  if (route.request().headers().authorization === `Bearer ${testToken}`) return false
  await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) })
  return true
}
