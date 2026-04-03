import { test, expect } from '@playwright/test'

test.describe('Chat smoke', () => {
  test('chat route loads and shows the composer input', async ({ page }) => {
    // /chat redirects to /chat/<sessionKey> (default: "new")
    await page.goto('/chat/new')

    // The chat composer should have a send-message button or a text input area.
    // Wait for the page to fully render (lazy-loaded ChatScreen).
    const sendButton = page.locator('[aria-label="Send message"]')
    const composerArea = page.locator('textarea, [contenteditable="true"], [role="textbox"]')

    // At least one of these should appear
    await expect(sendButton.or(composerArea).first()).toBeVisible({ timeout: 15_000 })
  })

  test('chat composer accepts typed text', async ({ page }) => {
    await page.goto('/chat/new')

    // Find the text input area
    const composerArea = page.locator('textarea, [contenteditable="true"], [role="textbox"]').first()
    await expect(composerArea).toBeVisible({ timeout: 15_000 })

    // Type a message
    await composerArea.fill('Hello from Playwright E2E test')

    // Verify the text was entered
    await expect(composerArea).toHaveValue(/Hello from Playwright/)
  })
})
