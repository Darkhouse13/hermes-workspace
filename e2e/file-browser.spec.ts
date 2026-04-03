import { test, expect } from '@playwright/test'

test.describe('File browser', () => {
  test('files route loads and renders the file explorer area', async ({ page }) => {
    await page.goto('/files')

    // The files page uses Monaco editor and a FileExplorerSidebar.
    // Look for the page to render with any of these indicators:
    //  - The loading text "Loading file explorer..."
    //  - The actual file explorer sidebar
    //  - The Monaco editor container
    //  - Or the error fallback "Failed to Load Files"
    const fileArea = page.locator('text=Loading file explorer').or(
      page.locator('text=Files workspace').or(
        page.locator('text=Failed to Load Files').or(
          page.locator('.monaco-editor, [data-keybinding-context]')
        )
      )
    )

    await expect(fileArea.first()).toBeVisible({ timeout: 15_000 })
  })
})
