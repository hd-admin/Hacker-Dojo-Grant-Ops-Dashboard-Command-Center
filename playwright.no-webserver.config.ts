import { defineConfig, devices } from '@playwright/test';
import { APP_BASE_URL } from './shared/app-config';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: APP_BASE_URL,
    headless: true,
    timeout: 60000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: {
          cookies: [],
          origins: [
            {
              origin: APP_BASE_URL,
              localStorage: [{ name: 'grantops.operatorName', value: 'E2E Test Operator' }],
            },
          ],
        },
      },
    },
  ],
});
