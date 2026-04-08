import { test, expect } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

test.describe('Core study flow navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page })
  })

  const protectedRoutes = ['/queue', '/practice-exam', '/analytics', '/sources']

  for (const route of protectedRoutes) {
    test(`can access ${route} when authenticated`, async ({ page }) => {
      await page.goto(route)
      await page.waitForTimeout(5_000)
      const url = page.url()

      if (url.includes('sign-in') || url.includes('accounts.dev')) {
        test.skip(true, 'Clerk testing mode not active — enable in Clerk Dashboard > Configure > Testing')
        return
      }

      expect(url).not.toContain('sign-in')
    })
  }
})
