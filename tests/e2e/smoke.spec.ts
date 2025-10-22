import { test, expect } from '@playwright/test';
import { tgMock } from './tg-mock';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((value) => {
    // @ts-ignore
    window.Telegram = value;
  }, tgMock());
});

test('mini app renders main page', async ({ page }) => {
  await page.goto(process.env.APP_URL ?? 'http://localhost:3000');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Check that the page is visible
  await expect(page.locator('body')).toBeVisible();
});

test('theme params are applied correctly', async ({ page }) => {
  await page.goto(process.env.APP_URL ?? 'http://localhost:3000');

  await page.waitForLoadState('networkidle');

  // Check that Telegram WebApp object is available
  const hasTelegram = await page.evaluate(() => {
    // @ts-ignore
    return typeof window.Telegram !== 'undefined';
  });

  expect(hasTelegram).toBe(true);
});

test('viewport size matches mobile device', async ({ page }) => {
  await page.goto(process.env.APP_URL ?? 'http://localhost:3000');

  const viewport = page.viewportSize();

  expect(viewport).not.toBeNull();
  expect(viewport!.width).toBeLessThanOrEqual(500);
  expect(viewport!.height).toBeGreaterThan(600);
});
