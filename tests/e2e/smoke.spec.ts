import { test, expect } from '@playwright/test';
import { tgMock } from './tg-mock';

test.beforeEach(async ({ page }) => {
  // Add Telegram WebApp mock before page loads
  await page.addInitScript((value) => {
    // @ts-ignore
    window.Telegram = value;
  }, tgMock());

  // Log console errors for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('Page error:', error.message);
  });
});

test('mini app loads successfully', async ({ page }) => {
  await page.goto(process.env.APP_URL ?? 'http://localhost:3000');

  // Wait for Next.js to be ready
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');

  // Debug: Check page title
  const title = await page.title();
  console.log('Page title:', title);

  // Debug: Check if body has content
  const bodyText = await page.locator('body').textContent();
  console.log('Body text length:', bodyText?.length || 0);

  // Check that Next.js rendered the page
  const html = await page.content();
  expect(html.length).toBeGreaterThan(100);

  // Check for Next.js hydration
  const hasNextData = await page.evaluate(() => {
    return !!document.getElementById('__NEXT_DATA__');
  });
  console.log('Has Next.js data:', hasNextData);
});

test('page contains main content', async ({ page }) => {
  await page.goto(process.env.APP_URL ?? 'http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Wait a bit more for React hydration
  await page.waitForTimeout(2000);

  // Check for any h1 element
  const headings = await page.locator('h1').count();
  console.log('Number of h1 elements:', headings);

  if (headings > 0) {
    const h1Text = await page.locator('h1').first().textContent();
    console.log('First h1 text:', h1Text);
    expect(h1Text).toBeTruthy();
  }

  // Check for any buttons
  const buttons = await page.locator('button').count();
  console.log('Number of buttons:', buttons);
  expect(buttons).toBeGreaterThan(0);
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

  console.log('Background color:', bgColor);
  expect(bgColor).toBeTruthy();
});

test('viewport size matches mobile device', async ({ page }) => {
  await page.goto(process.env.APP_URL ?? 'http://localhost:3000');

  const viewport = page.viewportSize();

  expect(viewport).not.toBeNull();
  expect(viewport!.width).toBeLessThanOrEqual(500);
  expect(viewport!.height).toBeGreaterThan(600);
});
