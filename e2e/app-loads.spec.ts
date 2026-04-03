import { test, expect } from '@playwright/test'

test.describe('App loads', () => {
  test('root redirects to /dashboard and renders the workspace heading', async ({ page }) => {
    await page.goto('/')

    // The index route redirects to /dashboard
    await page.waitForURL('**/dashboard')

    // The dashboard should render the "Hermes Workspace" heading
    const heading = page.locator('h1', { hasText: 'Hermes Workspace' })
    await expect(heading).toBeVisible({ timeout: 15_000 })
  })

  test('dashboard displays quick-action buttons', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/dashboard')

    // Quick actions like "New Chat" and "Terminal" should be visible
    await expect(page.getByText('New Chat')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Terminal')).toBeVisible()
  })
})
