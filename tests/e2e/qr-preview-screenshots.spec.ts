import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { getUrlInputLocator, openGeneratorTab, setupGeneratorPage } from './utils/generator';

type MetadataScope = 'container' | 'page';

async function writeCanvasMetadata(
  page: Page,
  screenshotPath: string,
  canvasLocator: Locator,
  scope: MetadataScope,
  referenceLocator?: Locator,
  payload?: string
) {
  const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio ?? 1);

  const canvasRect = await canvasLocator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  });

  let cropRect = { ...canvasRect };

  if (scope === 'container' && referenceLocator) {
    const containerRect = await referenceLocator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    });

    cropRect = {
      x: canvasRect.x - containerRect.x,
      y: canvasRect.y - containerRect.y,
      width: canvasRect.width,
      height: canvasRect.height
    };
  }

  const scrollOffset = await page.evaluate(() => ({
    x: window.scrollX ?? 0,
    y: window.scrollY ?? 0
  }));

  const metadata: Record<string, unknown> = {
    scope,
    devicePixelRatio,
    canvas: canvasRect,
    crop: cropRect
  };

  if (scope === 'page' || scrollOffset.x || scrollOffset.y) {
    metadata.scroll = scrollOffset;
  }

  if (typeof payload === 'string') {
    metadata.payload = payload;
  }

  await fs.writeFile(`${screenshotPath}.json`, JSON.stringify(metadata, null, 2), 'utf8');
}

async function capturePreviewScreenshot(
  page: Page,
  qrContainer: Locator,
  filename: string,
  payload: string
) {
  const path = `screenshots/${filename}`;
  await qrContainer.screenshot({
    path,
    animations: 'disabled'
  });

  const canvas = qrContainer.locator('canvas, svg').first();
  await writeCanvasMetadata(page, path, canvas, 'container', qrContainer, payload);
}

test.beforeEach(async ({ page }, testInfo) => {
  await setupGeneratorPage(page, testInfo);
});

test.describe('QR Code Preview Screenshots', () => {
  test.use({
    storageState: undefined
  });

  test('capture default QR preview', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await openGeneratorTab(page);

    // Wait for QR preview container with CSS module class pattern
    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = getUrlInputLocator(page);
    await urlInput.waitFor({ state: 'visible', timeout: 30_000 });
    await urlInput.fill('https://example.com');

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take screenshot of the preview area
    await capturePreviewScreenshot(
      page,
      qrContainer,
      `qr-preview-default-${testInfo.project.name}.png`,
      'https://example.com'
    );
  });

  test('capture QR preview with custom colors', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await openGeneratorTab(page);

    // Wait for QR preview container
    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = getUrlInputLocator(page);
    await urlInput.waitFor({ state: 'visible', timeout: 30_000 });
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

    // Take screenshot
    await capturePreviewScreenshot(
      page,
      qrContainer,
      `qr-preview-custom-colors-${testInfo.project.name}.png`,
      'https://example.com/custom-colors'
    );
  });

  test('capture QR preview with circle shape', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await openGeneratorTab(page);

    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = getUrlInputLocator(page);
    await urlInput.waitFor({ state: 'visible', timeout: 30_000 });
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

    // Take screenshot
    await capturePreviewScreenshot(
      page,
      qrContainer,
      `qr-preview-circle-shape-${testInfo.project.name}.png`,
      'https://example.com/circle'
    );
  });

  test('capture QR preview with gradient', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await openGeneratorTab(page);

    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = getUrlInputLocator(page);
    await urlInput.waitFor({ state: 'visible', timeout: 30_000 });
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

    // Take screenshot
    await capturePreviewScreenshot(
      page,
      qrContainer,
      `qr-preview-gradient-${testInfo.project.name}.png`,
      'https://example.com/gradient'
    );
  });

  test('capture QR preview with different dot styles', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await openGeneratorTab(page);

    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = getUrlInputLocator(page);
    await urlInput.waitFor({ state: 'visible', timeout: 30_000 });
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

    // Take screenshot
    await capturePreviewScreenshot(
      page,
      qrContainer,
      `qr-preview-dot-style-${testInfo.project.name}.png`,
      'https://example.com/dot-style'
    );
  });

  test('capture full page with QR preview', async ({ page }, testInfo) => {
    const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
    test.skip(
      hasWebKitProject && testInfo.project.name.includes('Android'),
      'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
    );

    await openGeneratorTab(page);

    const qrContainer = page.locator('[class*="qrPreview"]').first();
    await qrContainer.waitFor({ state: 'visible', timeout: 30_000 });

    // Fill in URL field
    const urlInput = getUrlInputLocator(page);
    await urlInput.waitFor({ state: 'visible', timeout: 30_000 });
    await urlInput.fill('https://example.com/full-page');

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take full page screenshot
    const fullPagePath = `screenshots/qr-full-page-${testInfo.project.name}.png`;
    await page.screenshot({
      path: fullPagePath,
      fullPage: true,
      animations: 'disabled'
    });

    const canvas = page.locator('[class*="qrPreview"]').first().locator('canvas, svg').first();
    await writeCanvasMetadata(
      page,
      fullPagePath,
      canvas,
      'page',
      undefined,
      'https://example.com/full-page'
    );
  });
});
