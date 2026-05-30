import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
    timeout: 60000,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bash ./playwright-start.sh',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: {
          cookies: [],
          origins: [{
            origin: 'http://127.0.0.1:3000',
            localStorage: [{ name: 'grantops.setupCompleted', value: 'true' }],
          }],
        },
      },
    },
  ],
});
