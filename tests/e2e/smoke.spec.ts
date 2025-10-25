import { test, expect } from '@playwright/test';
import { tgMock } from './tg-mock';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((value) => {
    // @ts-ignore - injected before app bootstraps
    window.Telegram = value;
  }, tgMock());
});

test('generator tab renders key controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('Android'), 'Android viewport hydration is flaky under Playwright; covered by WebKit suite.');

  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('main.page', { timeout: 30_000 });

  const styleTab = page.getByRole('button', { name: '🎨 Стиль' });
  await styleTab.waitFor({ state: 'visible', timeout: 30_000 });
  await styleTab.click();

  const geometrySection = page.locator('text=🧩 Геометрия');
  await expect(geometrySection).toBeVisible();
  await expect(page.locator('label:has-text("Расстояние между точками")')).toBeVisible();
  const spacingSlider = page.locator('label:has-text("Расстояние между точками") + input[type="range"]');
  await expect(spacingSlider).toHaveAttribute('value', '0');

  const advancedTab = page.getByRole('button', { name: '⚙️ Продвинутые' });
  await expect(advancedTab).toBeVisible();
  await advancedTab.click();
  await expect(page.locator('text=Проценты показывают, какую часть QR-кода можно закрыть')).toBeVisible();
});

test('scanner tab exposes camera and upload controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('Android'), 'Android viewport hydration is flaky under Playwright; covered by WebKit suite.');

  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('main.page', { timeout: 30_000 });

  const scannerTab = page.getByRole('button', { name: '📷 Сканер' });
  await scannerTab.waitFor({ state: 'visible', timeout: 30_000 });
  await scannerTab.click();
  await expect(page.getByRole('heading', { name: 'Клиентский сканер' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Включить камеру' })).toBeVisible();
  await expect(page.locator('label:has-text("Загрузить изображение")')).toBeVisible();
});

test('telegram webapp mock is available on the page', async ({ page }) => {
  await page.goto(APP_URL);
  await page.waitForLoadState('networkidle');

  const hasTelegram = await page.evaluate(() => {
    // @ts-ignore - provided by init script
    return typeof window.Telegram?.WebApp?.platform === 'string';
  });

  expect(hasTelegram).toBe(true);
});
