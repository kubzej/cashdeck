import { expect, test } from '@playwright/test'

test('logs in, protects the shell, switches destinations, and logs out', async ({ page }) => {
  let isAuthenticated = false
  const session = {
    user: {
      id: 'user-1',
      email: 'jakub@example.com',
      name: 'Jakub',
    },
    session: {
      id: 'session-1',
      userId: 'user-1',
    },
  }

  await page.route('http://neon.test/auth/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (pathname.endsWith('/get-session')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          session: isAuthenticated ? session.session : null,
          user: isAuthenticated ? session.user : null,
        }),
      })
      return
    }

    if (pathname.endsWith('/sign-in/email')) {
      const body = request.postDataJSON() as { email?: string; password?: string }
      const validCredentials = body.email === 'jakub@example.com' && body.password === 'correct-password'

      if (!validCredentials) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid credentials' }),
        })
        return
      }

      isAuthenticated = true
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ token: 'token-1', user: session.user }),
      })
      return
    }

    if (pathname.endsWith('/sign-out')) {
      isAuthenticated = false
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
      return
    }

    await route.continue()
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Přihlášení' })).toBeVisible()
  await page.getByLabel('Email').fill('wrong@example.com')
  await page.getByLabel('Heslo').fill('wrong-password')
  await page.getByRole('button', { name: 'Přihlásit se' }).click()
  await expect(page.getByText('Email nebo heslo není správně.')).toBeVisible()

  await page.getByLabel('Email').fill('jakub@example.com')
  await page.getByLabel('Heslo').fill('correct-password')
  await page.getByRole('button', { name: 'Přihlásit se' }).click()
  await expect(page.getByRole('heading', { name: 'Transakce' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' })).toBeVisible()

  await page.getByRole('button', { name: 'Peněženky' }).click()
  await expect(page.getByRole('heading', { name: 'Peněženky' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Transakce' })).toBeVisible()
  await page.getByRole('button', { name: 'Peněženky' }).click()
  await expect(page.getByRole('heading', { name: 'Peněženky' })).toBeVisible()

  await page.getByRole('button', { name: 'Přepnout na tmavý motiv' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('button', { name: 'Přepnout na světlý motiv' })).toBeVisible()

  await page.getByRole('button', { name: 'Nastavení' }).click()
  await page.getByRole('button', { name: 'Odhlásit se' }).click()
  await expect(page.getByRole('heading', { name: 'Přihlášení' })).toBeVisible()
})
