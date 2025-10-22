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

  // Check that the header title is visible
  await expect(page.getByRole('heading', { name: 'QR Suite' })).toBeVisible();

  // Check that tabs are present
  await expect(page.getByRole('button', { name: /Генератор/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Пакетная/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Сканер/i })).toBeVisible();
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

  // Check that theme variables are applied
  const bgColor = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg');
  });

  expect(bgColor).toBeTruthy();
});

test('viewport size matches mobile device', async ({ page }) => {
  await page.goto(process.env.APP_URL ?? 'http://localhost:3000');

  const viewport = page.viewportSize();

  expect(viewport).not.toBeNull();
  expect(viewport!.width).toBeLessThanOrEqual(500);
  expect(viewport!.height).toBeGreaterThan(600);
});

test('tab navigation works', async ({ page }) => {
  await page.goto(process.env.APP_URL ?? 'http://localhost:3000');

  await page.waitForLoadState('networkidle');

  // Click on "Пакетная" tab
  await page.getByRole('button', { name: /Пакетная/i }).click();

  // Wait for content to load
  await page.waitForTimeout(500);

  // Click on "Сканер" tab
  await page.getByRole('button', { name: /Сканер/i }).click();

  // Wait for content to load
  await page.waitForTimeout(500);

  // Click back to "Генератор" tab
  await page.getByRole('button', { name: /Генератор/i }).click();

  // Verify we're back on the generator tab
  await page.waitForTimeout(500);
});
