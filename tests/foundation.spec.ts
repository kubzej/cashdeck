import { expect, test } from '@playwright/test'

test('signs in, protects the shell, and signs out', async ({ page }) => {
  let isAuthenticated = false
  const user = { id: 'user-1', email: 'jakub@example.com', name: 'Jakub' }

  await page.route('http://neon.test/auth/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname

    if (pathname.endsWith('/get-session')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          session: isAuthenticated ? { id: 'session-1', userId: user.id, token: 'token-1' } : null,
          user: isAuthenticated ? user : null,
        }),
      })
      return
    }

    if (pathname.endsWith('/sign-in/email')) {
      isAuthenticated = true
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user }) })
      return
    }

    if (pathname.endsWith('/sign-out')) {
      isAuthenticated = false
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) })
      return
    }

    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) })
  })

  await page.route('http://api.test/api/session', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer token-1')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ userId: user.id }),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Přihlášení' })).toBeVisible()
  await page.getByLabel('Email').fill('jakub@example.com')
  await page.getByLabel('Heslo').fill('secure-password')
  await page.getByRole('button', { name: 'Přihlásit se' }).click()

  await expect(page.getByRole('heading', { name: 'Transakce', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await expect(page.getByRole('heading', { name: 'Peněženky' })).toBeVisible()

  await page.getByRole('button', { name: 'Odhlásit se' }).click()
  await expect(page.getByRole('heading', { name: 'Přihlášení' })).toBeVisible()
})
