import { test, expect } from '@playwright/test'

test('create test user and sign in', async ({ page }) => {
  // Sign up
  await page.goto('/sign-up')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2_000)

  await page.locator('input[name="firstName"]').fill('Test')
  await page.locator('input[name="lastName"]').fill('User')
  await page.locator('input[name="emailAddress"]').fill('your_email+clerk_test@example.com')
  await page.locator('input[name="password"]').fill('424242424242')

  await page.locator('.cl-formButtonPrimary').first().click()
  await page.waitForTimeout(3_000)
  await page.screenshot({ path: 'e2e/screenshots/10-after-signup.png', fullPage: true })

  // Check if there's an email verification step
  const codeInput = page.locator('input[name="code"]')
  if (await codeInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
    console.log('Code input found — entering 424242')
    await codeInput.fill('424242')
    await page.locator('.cl-formButtonPrimary').first().click()
    await page.waitForTimeout(3_000)
  }

  await page.screenshot({ path: 'e2e/screenshots/11-final-state.png', fullPage: true })
  console.log('Final URL:', page.url())

  // Log buttons/inputs
  const buttons = await page.locator('button:visible').allTextContents()
  console.log('Buttons:', buttons)
})
