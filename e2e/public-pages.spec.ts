import { test, expect } from '@playwright/test'

test.describe('Public pages (no auth)', () => {
  test('home page loads with hero and sign-up CTA', async ({ page }) => {
    await page.goto('/')
    // Should see the landing page — h1 renders even if Clerk fails to auth
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
    // Sign-up link should be present
    await expect(page.locator('a[href="/sign-up"]').first()).toBeVisible()
  })

  test('pricing page renders price cards', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')
    // Wait for lazy-loaded page to render — Clerk may take time to load
    await expect(page.locator('text=29.99').first()).toBeVisible({ timeout: 15_000 })
  })

  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('h1')).toContainText(/privacy/i, { timeout: 10_000 })
  })

  test('terms of service page loads', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.locator('h1')).toContainText(/terms/i, { timeout: 10_000 })
  })

  test('all-tools page lists tools', async ({ page }) => {
    await page.goto('/all-tools')
    // Should see tool cards/links
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a').filter({ hasText: /calculator|counter|timer|converter/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('word counter tool page loads', async ({ page }) => {
    await page.goto('/word-counter')
    await page.waitForLoadState('networkidle')
    // Should have a textarea
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 })
  })

  test('periodic table tool page loads', async ({ page }) => {
    await page.goto('/periodic-table')
    await page.waitForLoadState('networkidle')
    // Should show element data
    await expect(page.locator('text=H').or(page.locator('text=Hydrogen')).first()).toBeVisible({ timeout: 10_000 })
  })

  test('GPA calculator page loads', async ({ page }) => {
    await page.goto('/gpa-calculator')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })
})
