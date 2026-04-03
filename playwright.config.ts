import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for Hermes Workspace.
 *
 * Run all tests:   npx playwright test
 * Run with UI:     npx playwright test --ui
 * Debug a test:    npx playwright test --debug
 */
export default defineConfig({
  testDir: './e2e',

  /* Maximum time one test can run */
  timeout: 30_000,

  /* Assertion timeout */
  expect: {
    timeout: 10_000,
  },

  /* Fail the build on CI if test.only is left in source */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests in CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker locally, parallel in CI */
  workers: process.env.CI ? 2 : 1,

  /* Reporter configuration */
  reporter: process.env.CI ? 'html' : 'list',

  /* Shared settings for all projects */
  use: {
    baseURL: 'http://localhost:3000',

    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',

    /* Collect trace on first retry (useful in CI) */
    trace: 'on-first-retry',

    /* Reasonable navigation timeout */
    navigationTimeout: 15_000,
  },

  /* Only Chromium for simplicity */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the dev server before running tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
