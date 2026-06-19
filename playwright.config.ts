import { defineConfig, devices } from '@playwright/test';

const backendPort = process.env.E2E_BACKEND_PORT || '4001';
const frontendPort = process.env.E2E_FRONTEND_PORT || '3001';
const e2eSecret = process.env.E2E_SECRET || 'e2e-dev-secret-change-me';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `npm run start --prefix backend-node`,
      url: `http://127.0.0.1:${backendPort}/health/live`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        E2E_TEST_MODE: 'true',
        E2E_SECRET: e2eSecret,
        E2E_BACKEND_PORT: backendPort,
      },
    },
    {
      command: `npm run dev --prefix frontend -- --port ${frontendPort} --strictPort`,
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        BACKEND_PORT: backendPort,
        VITE_BACKEND_PORT: backendPort,
      },
    },
  ],
});
