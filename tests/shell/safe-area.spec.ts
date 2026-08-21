import { expect, test } from '@playwright/test'
import { openSignedInApp } from '../support/auth'

// Playwright's device emulation always reports env(safe-area-inset-bottom) as 0 — there's no
// notch/home-indicator hardware to derive it from — so this is the only way to catch a bug in
// how the app handles a real iPhone's safe area without deploying and testing on a physical
// device. Chrome DevTools Protocol can override it directly (Chromium-only, not available in
// WebKit); this project's iphone config already runs Chromium under an iPhone device profile.
test('bottom nav reaches the true bottom edge with a real iPhone safe-area-inset-bottom, no gap below it', async ({ page, context }) => {
  const client = await context.newCDPSession(page)
  await client.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: 59, topMax: 59, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 },
  })

  await openSignedInApp(page)

  const nav = page.locator('.bottom-nav')
  const navBox = await nav.boundingBox()
  const viewportHeight = page.viewportSize()?.height
  if (!navBox || !viewportHeight) throw new Error('Nepodařilo se změřit spodní menu.')

  expect(navBox.y + navBox.height).toBeCloseTo(viewportHeight, 0)
})
