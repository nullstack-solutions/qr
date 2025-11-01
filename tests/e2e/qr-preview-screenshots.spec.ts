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

  test('capture QR preview with custom geometry', async ({ page }, testInfo) => {
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

    // Ensure geometry controls are visible
    const geometrySection = page.locator('text=🧩 Геометрия').first();
    await expect(geometrySection).toBeVisible();

    // Adjust geometry options
    const shapeSelect = page.locator('label:has-text("Форма QR") select').first();
    await shapeSelect.selectOption('circle');

    const dotStyleSelect = page.locator('label:has-text("Стиль точек") select').first();
    await dotStyleSelect.selectOption('custom:heart');

    const innerEyeSelect = page.locator('label:has-text("Внутренние глазки") select').first();
    await innerEyeSelect.selectOption('custom:star');

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take screenshot
    await capturePreviewScreenshot(
      page,
      qrContainer,
      `qr-preview-custom-geometry-${testInfo.project.name}.png`,
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

    const shapeSelect = page.locator('label:has-text("Форма QR") select').first();
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

  test('capture QR preview with increased dot spacing', async ({ page }, testInfo) => {
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

    const spacingSlider = page
      .locator('div:has(>label:has-text("↔️ Расстояние между точками")) input[type="range"]')
      .first();
    await spacingSlider.evaluate((input: HTMLInputElement) => {
      input.value = '25';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Click generate button
    const generateBtn = page.getByRole('button', { name: '⬇️ Скачать QR' });
    await generateBtn.click();

    // Wait for QR code to render
    await page.waitForTimeout(1500);

    // Take screenshot
    await capturePreviewScreenshot(
      page,
      qrContainer,
      `qr-preview-spacing-${testInfo.project.name}.png`,
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
