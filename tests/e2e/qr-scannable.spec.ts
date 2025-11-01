import { test, expect, type Locator, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { getUrlInputLocator, openGeneratorTab, setupGeneratorPage } from './utils/generator';

function decodeQr(buffer: Buffer): string | null {
  const png = PNG.sync.read(buffer);
  const data = Uint8ClampedArray.from(png.data);
  const code = jsQR(data, png.width, png.height);
  return code?.data ?? null;
}

async function getPreviewCanvas(page: Page): Promise<Locator> {
  const container = page.locator('[class*="qrPreview"]').first();
  await container.waitFor({ state: 'visible', timeout: 30_000 });
  const canvas = container.locator('canvas, svg').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  return canvas;
}

test.beforeEach(async ({ page }, testInfo) => {
  await setupGeneratorPage(page, testInfo);
});

test.describe('QR code scannability', () => {
  test.use({
    storageState: undefined
  });

  test('generates a scannable QR code for URLs', async ({ page }) => {
    await openGeneratorTab(page);

    const urlInput = getUrlInputLocator(page);
    await urlInput.fill('https://example.com/scannable');

    await page.getByRole('button', { name: '⬇️ Скачать QR' }).click();
    await page.waitForTimeout(500);

    const canvas = await getPreviewCanvas(page);
    const qrData = decodeQr(await canvas.screenshot());
    expect(qrData).not.toBeNull();
    expect(qrData).toBe('https://example.com/scannable');
  });

  test('supports different dot styles without breaking decoding', async ({ page }) => {
    await openGeneratorTab(page);

    const testUrl = 'https://telegram.org/play';
    const urlInput = getUrlInputLocator(page);
    await urlInput.fill(testUrl);

    const styleTab = page.getByRole('button', { name: '🎨 Стиль' });
    await styleTab.click();

    const dotStyleSelect = page.locator('label:has-text("Стиль точек") select').first();
    await expect(dotStyleSelect).toBeVisible();

    const styleOptions = [
      { label: 'Квадраты', value: 'square' },
      { label: 'Точки', value: 'dots' },
      { label: 'Скругленные', value: 'rounded' }
    ];

    for (const { label, value } of styleOptions) {
      await dotStyleSelect.selectOption(value);

      await page.getByRole('button', { name: '⬇️ Скачать QR' }).click();
      await page.waitForTimeout(500);

      const canvas = await getPreviewCanvas(page);
      const qrData = decodeQr(await canvas.screenshot());
      expect(qrData, `QR with dot style "${label}" should be decodable`).toBe(testUrl);
    }
  });

  test('keeps QR readable with increased dot spacing', async ({ page }) => {
    await openGeneratorTab(page);

    const urlInput = getUrlInputLocator(page);
    await urlInput.fill('https://github.com/telegram-mini-apps');

    const styleTab = page.getByRole('button', { name: '🎨 Стиль' });
    await styleTab.click();

    const spacingSlider = page
      .locator('div:has(>label:has-text("↔️ Расстояние между точками")) input[type="range"]')
      .first();
    await spacingSlider.evaluate((input: HTMLInputElement) => {
      input.value = '35';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.getByRole('button', { name: '⬇️ Скачать QR' }).click();
    await page.waitForTimeout(500);

    const canvas = await getPreviewCanvas(page);
    const qrData = decodeQr(await canvas.screenshot());
    expect(qrData).toBe('https://github.com/telegram-mini-apps');
  });

  test('renders Cyrillic text payloads without cropping', async ({ page }) => {
    await openGeneratorTab(page);

    await page.getByTestId('qr-template-text').click();

    const textInput = page.getByTestId('qr-input-text');
    const payload = 'Привет, мир! 🌍';
    await textInput.fill(payload);

    await page.getByRole('button', { name: '⬇️ Скачать QR' }).click();
    await page.waitForTimeout(500);

    const canvas = await getPreviewCanvas(page);
    const qrData = decodeQr(await canvas.screenshot());
    expect(qrData).toBe(payload);
  });
});
