import { defineConfig, devices } from '@playwright/test';

const forceWebKit = process.env.PLAYWRIGHT_FORCE_WEBKIT === '1';
const disableWebKit = process.env.PLAYWRIGHT_WEBKIT === '0';
const canUseWebKit = forceWebKit || (!disableWebKit && process.platform !== 'linux');

const projects = [] as {
  name: string;
  use: Record<string, unknown>;
}[];

if (canUseWebKit) {
  projects.push({
    name: 'iOS-like WebKit',
    use: {
      ...devices['iPhone 14'],
      browserName: 'webkit'
    }
  });
} else {
  console.warn('Skipping WebKit Playwright project (set PLAYWRIGHT_FORCE_WEBKIT=1 to override).');
}

projects.push({
  name: 'Android-like Chromium',
  use: {
    ...devices['Pixel 7'],
    browserName: 'chromium'
  }
});

export default defineConfig({
  timeout: 60_000,
  testDir: 'tests/e2e',
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    headless: true,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects,
  webServer: {
    command: process.env.CI ? 'npm run serve' : 'npm run dev',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
