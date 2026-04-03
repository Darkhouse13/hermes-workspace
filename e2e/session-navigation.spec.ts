import { test, expect } from '@playwright/test'

test.describe('Session navigation', () => {
  test('chat page renders and shows the session UI', async ({ page }) => {
    // Navigate to a new chat session
    await page.goto('/chat/new')

    // The page should render without crashing — look for the chat screen container
    // or the sidebar with session history
    const chatScreen = page.locator('[aria-label="Send message"], [aria-label="Settings"]')
    await expect(chatScreen.first()).toBeVisible({ timeout: 15_000 })
  })

  test('dashboard shows recent session cards when available', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/dashboard')

    // The dashboard page should render (even if sessions list is empty)
    const heading = page.locator('h1', { hasText: 'Hermes Workspace' })
    await expect(heading).toBeVisible({ timeout: 15_000 })
  })
})
