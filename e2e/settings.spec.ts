import { test, expect } from '@playwright/test'

test.describe('Settings page', () => {
  test('settings route loads and renders the page heading', async ({ page }) => {
    await page.goto('/settings')

    // The settings page shows an h1 with "Settings"
    const heading = page.locator('h1', { hasText: 'Settings' })
    await expect(heading).toBeVisible({ timeout: 15_000 })
  })

  test('settings page shows navigation sections', async ({ page }) => {
    await page.goto('/settings')

    // The settings page has navigation items for different sections
    await expect(page.getByText('Hermes Agent')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Appearance')).toBeVisible()
    await expect(page.getByText('Chat')).toBeVisible()
    await expect(page.getByText('Notifications')).toBeVisible()
  })
})
