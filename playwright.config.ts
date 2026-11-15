import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.e2e.ts',
  timeout: 90000,
  workers: 1,
  webServer:
    process.env.YOTEACH_TEST_DEV === '1'
      ? { command: 'npx vite', url: 'http://127.0.0.1:5173', reuseExistingServer: true }
      : undefined,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
});
