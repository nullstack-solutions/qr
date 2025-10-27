import { test, expect } from '@playwright/test';
import { tgMock } from './tg-mock';

const repoBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  process.env.BASE_PATH ??
  (process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}` : '');

const sanitizedBasePath = repoBasePath?.replace(/^\/+/, '').replace(/\/+$/, '') ?? '';
const normalizedBasePath = sanitizedBasePath ? `/${sanitizedBasePath}` : '';

const APP_URL = process.env.APP_URL ?? `http://localhost:3000${normalizedBasePath}`;

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.config.workers === 1) {
    page.on('console', (msg) => console.log(`[console:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
  }

  await page.addInitScript((value) => {
    const stub = () => {};
    const baseWebApp = value?.WebApp ?? {};

    const stubbedWebApp = {
      ...baseWebApp,
      ready: stub,
      expand: stub,
      close: stub,
      enableClosingConfirmation: stub,
      disableClosingConfirmation: stub,
      onEvent: stub,
      offEvent: stub,
      sendData: stub,
      openLink: stub,
      openTelegramLink: stub,
      showPopup: stub,
      showAlert: stub,
      showConfirm: stub,
      showScanQrPopup: stub,
      closeScanQrPopup: stub,
      readTextFromClipboard: stub,
      HapticFeedback: {
        ...(baseWebApp.HapticFeedback ?? {}),
        impactOccurred: stub,
        notificationOccurred: stub,
        selectionChanged: stub
      },
      MainButton: {
        ...(baseWebApp.MainButton ?? {}),
        show: stub,
        hide: stub,
        setText: stub,
        enable: stub,
        disable: stub,
        showProgress: stub,
        hideProgress: stub,
        setParams: stub,
        onClick: stub,
        offClick: stub
      },
      BackButton: {
        ...(baseWebApp.BackButton ?? {}),
        show: stub,
        hide: stub,
        onClick: stub,
        offClick: stub
      }
    };

    // @ts-ignore - injected before app bootstraps
    window.Telegram = { ...value, WebApp: stubbedWebApp };
  }, tgMock());
});

test.describe('QR Code Preview Screenshots', () => {
  test('capture QR preview with default settings', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    // Clear all caches and storage to ensure fresh QR generation
    await page.context().clearCookies();
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for the generator tab to be visible (it's the default tab)
    await page.waitForSelector('button:has-text("🎨 Генератор")', { timeout: 30_000 });

    // Wait for QR preview container with CSS module class pattern
    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = page.locator('input[placeholder*="example.com/page"]').first();
    await urlInput.waitFor({ state: 'visible' });
    await urlInput.fill('https://example.com');

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take screenshot of the .qrCode container (white box with padding)
    // This captures the full QR code with proper margin
    const qrCodeBox = await qrContainer.locator('[class*="qrCode"]').first();
    await qrCodeBox.waitFor({ state: 'visible' });

    // Temporarily remove border-radius and ensure overflow visible for screenshot
    // This ensures QR code is fully visible and scannable
    await qrCodeBox.evaluate((el: HTMLElement) => {
      el.style.borderRadius = '0';
      el.style.overflow = 'visible';
    });

    await qrCodeBox.screenshot({
      path: `screenshots/qr-preview-default-${testInfo.project.name}.png`,
      animations: 'disabled'
    });
  });

  test('capture QR preview with custom colors', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait for the generator tab to be visible (it's the default tab)
    await page.waitForSelector('button:has-text("🎨 Генератор")', { timeout: 30_000 });

    // Wait for QR preview container
    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = page.locator('input[placeholder*="example.com/page"]').first();
    await urlInput.fill('https://example.com/custom-colors');

    // Open style tab
    const styleTab = page.getByRole('button', { name: '🎨 Стиль' });
    await styleTab.click();

    // Change foreground color (dots color)
    const colorSection = page.locator('text=🎨 Цветовая схема').first();
    await expect(colorSection).toBeVisible();

    // Find color inputs and change them
    const colorInputs = page.locator('input[type="color"]');
    await colorInputs.nth(0).evaluate((el: HTMLInputElement, value: string) => el.value = value, '#FF5733'); // Foreground color
    await colorInputs.nth(1).evaluate((el: HTMLInputElement, value: string) => el.value = value, '#F0F8FF'); // Background color

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take screenshot of SVG only
    const svg = await qrContainer.locator('svg').first();
    await svg.screenshot({
      path: `screenshots/qr-preview-custom-colors-${testInfo.project.name}.png`,
      animations: 'disabled'
    });
  });

  test('capture QR preview with circle shape', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait for the generator tab and QR preview container
    await page.waitForSelector('button:has-text("🎨 Генератор")', { timeout: 30_000 });
    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = page.locator('input[placeholder*="example.com/page"]').first();
    await urlInput.fill('https://example.com/circle');

    // Open style tab
    const styleTab = page.getByRole('button', { name: '🎨 Стиль' });
    await styleTab.click();

    // Find and change shape to circle
    const geometrySection = page.locator('text=🧩 Геометрия').first();
    await expect(geometrySection).toBeVisible();

    // Find shape select and change to circle
    const shapeSelect = page.locator('select').filter({ hasText: 'Квадрат' }).or(page.locator('select').filter({ hasText: 'Круг' })).first();
    await shapeSelect.selectOption('circle');

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take screenshot of SVG only
    const svg = await qrContainer.locator('svg').first();
    await svg.screenshot({
      path: `screenshots/qr-preview-circle-shape-${testInfo.project.name}.png`,
      animations: 'disabled'
    });
  });

  test('capture QR preview with gradient', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait for the generator tab and QR preview container
    await page.waitForSelector('button:has-text("🎨 Генератор")', { timeout: 30_000 });
    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = page.locator('input[placeholder*="example.com/page"]').first();
    await urlInput.fill('https://example.com/gradient');

    // Open style tab
    const styleTab = page.getByRole('button', { name: '🎨 Стиль' });
    await styleTab.click();

    // Enable gradient for dots - find the first gradient checkbox (for dots section)
    const gradientCheckbox = page.locator('input[type="checkbox"]').first();
    await gradientCheckbox.check();

    // Wait for gradient controls to appear
    await page.waitForTimeout(500);

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take screenshot of SVG only
    const svg = await qrContainer.locator('svg').first();
    await svg.screenshot({
      path: `screenshots/qr-preview-gradient-${testInfo.project.name}.png`,
      animations: 'disabled'
    });
  });

  test('capture QR preview with different dot styles', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait for the generator tab and QR preview container
    await page.waitForSelector('button:has-text("🎨 Генератор")', { timeout: 30_000 });
    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = page.locator('input[placeholder*="example.com/page"]').first();
    await urlInput.fill('https://example.com/dot-style');

    // Open style tab
    const styleTab = page.getByRole('button', { name: '🎨 Стиль' });
    await styleTab.click();

    // Find dot style select - be more specific by finding the select with "Стиль точек" label
    const dotStyleLabel = page.locator('text=Стиль точек');
    await dotStyleLabel.waitFor({ state: 'visible' });
    const dotStyleSelect = dotStyleLabel.locator('..').locator('select');
    await dotStyleSelect.selectOption({ value: 'dots' });

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take screenshot of SVG only
    const svg = await qrContainer.locator('svg').first();
    await svg.screenshot({
      path: `screenshots/qr-preview-dot-style-${testInfo.project.name}.png`,
      animations: 'disabled'
    });
  });

  test('capture full page with QR preview', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait for the generator tab and QR preview container
    await page.waitForSelector('button:has-text("🎨 Генератор")', { timeout: 30_000 });
    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = page.locator('input[placeholder*="example.com/page"]').first();
    await urlInput.fill('https://example.com/full-page');

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take full page screenshot
    await page.screenshot({
      path: `screenshots/qr-full-page-${testInfo.project.name}.png`,
      fullPage: true,
      animations: 'disabled'
    });
  });
});
