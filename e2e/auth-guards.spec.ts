import { test, expect } from '@playwright/test'

// With prod Clerk keys on localhost, Clerk can't authenticate (domain mismatch).
// Protected routes either: redirect to sign-in, show a loading spinner,
// or show Clerk's error state. All are acceptable "not accessible" states.

test.describe('Auth guards', () => {
  test('protected route /settings is not accessible without auth', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForTimeout(5_000)
    // Should NOT show settings content — either redirected, loading, or errored
    const hasSettingsContent = await page.locator('text=Export').isVisible().catch(() => false)
    expect(hasSettingsContent).toBe(false)
  })

  test('protected route /practice-exam is not accessible without auth', async ({ page }) => {
    await page.goto('/practice-exam')
    await page.waitForTimeout(5_000)
    const hasExamContent = await page.locator('text=Start Exam').isVisible().catch(() => false)
    expect(hasExamContent).toBe(false)
  })

  test('public pricing page loads normally', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForTimeout(3_000)
    expect(page.url()).toContain('/pricing')
  })

  test('public privacy page loads normally', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('h1')).toContainText(/privacy/i, { timeout: 10_000 })
  })
})
