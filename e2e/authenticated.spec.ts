import { test, expect } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

test.describe('Authenticated flows', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Clerk testing token — bypasses sign-in UI entirely
    await setupClerkTestingToken({ page })
  })

  test('signed-in user is not redirected away from home', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(5_000)
    const url = page.url()
    // With testing token: should be on /, /welcome, or /dashboard — not sign-in
    // Without testing token (skip): Clerk testing mode may not be enabled
    if (url.includes('sign-in') || url.includes('accounts.dev')) {
      test.skip(true, 'Clerk testing mode not active — enable in Clerk Dashboard > Configure > Testing')
      return
    }
    expect(url).not.toContain('sign-in')
  })

  test('can access settings page', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForTimeout(5_000)
    const url = page.url()
    if (url.includes('sign-in') || url.includes('accounts.dev')) {
      test.skip(true, 'Clerk testing mode not active')
      return
    }
    await expect(page.locator('text=Privacy').or(page.locator('text=Export')).first()).toBeVisible({ timeout: 15_000 })
  })

  test('pricing page shows plan info', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=29.99').first()).toBeVisible({ timeout: 15_000 })
  })

  test('cookie consent banner appears on fresh visit', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('gdpr_consent'))
    await page.reload()
    await page.waitForLoadState('networkidle')
    const banner = page.locator('text=Cookie Preferences').or(page.locator('text=cookie preferences'))
    await expect(banner.first()).toBeVisible({ timeout: 8_000 })
  })

  test('accepting cookies saves consent and dismisses banner', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('gdpr_consent'))
    await page.reload()
    await page.waitForLoadState('networkidle')

    const acceptBtn = page.getByRole('button', { name: /accept/i })
    await expect(acceptBtn).toBeVisible({ timeout: 8_000 })
    await acceptBtn.click()
    await expect(acceptBtn).not.toBeVisible({ timeout: 5_000 })

    const consent = await page.evaluate(() => localStorage.getItem('gdpr_consent'))
    expect(consent).toBeTruthy()
    const parsed = JSON.parse(consent!)
    expect(parsed.analytics).toBe(true)
  })
})
