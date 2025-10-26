# QR Preview Screenshots

This directory contains E2E tests that generate visual screenshots of QR code previews with different settings.

## Purpose

These screenshots help verify that:
- QR codes render correctly in the preview
- Different styles and settings work as expected
- The preview container properly displays QR codes without cropping
- Visual regressions can be detected before deployment

## Running Screenshot Tests Locally

```bash
# Build the app first
npm run build

# Run all E2E tests (including screenshots)
npm run test:e2e

# Or run only screenshot tests
npx playwright test qr-preview-screenshots
```

Screenshots will be saved to the `screenshots/` directory.

## Viewing Screenshots in CI/CD

After each test run in GitHub Actions, screenshots are automatically uploaded as artifacts:

1. Go to the GitHub Actions run
2. Scroll to the "Artifacts" section at the bottom
3. Download the **qr-preview-screenshots** artifact
4. Extract and view the PNG files

## Screenshot Variants

The test suite generates screenshots for:

1. **Default Settings** - QR code with default configuration
2. **Custom Colors** - QR code with custom foreground/background colors
3. **Circle Shape** - QR code with circular shape instead of square
4. **Gradient** - QR code with gradient applied to dots
5. **Different Dot Styles** - QR code with various dot patterns
6. **Full Page** - Complete page view including controls and preview

Each variant is captured for different device viewports:
- iOS-like WebKit (iPhone 14)
- Android-like Chromium (Pixel 7)

## Screenshot Naming Convention

Screenshots are named with the pattern:
```
qr-preview-{variant}-{device}.png
```

Examples:
- `qr-preview-default-iOS-like WebKit.png`
- `qr-preview-custom-colors-Android-like Chromium.png`
- `qr-full-page-iOS-like WebKit.png`

## Adding New Screenshot Tests

To add a new screenshot test variant:

1. Open `tests/e2e/qr-preview-screenshots.spec.ts`
2. Add a new test case following the existing pattern:

```typescript
test('capture QR preview with your-feature', async ({ page }, testInfo) => {
  // Skip flaky Android test when WebKit is available
  const hasWebKitProject = testInfo.config.projects.some((project) => project.name.includes('WebKit'));
  test.skip(
    hasWebKitProject && testInfo.project.name.includes('Android'),
    'Android viewport hydration is flaky under Playwright when WebKit coverage is available.'
  );

  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.preview__canvas', { timeout: 30_000 });

  // Configure your QR settings here
  // ...

  // Take screenshot
  const preview = page.locator('.preview');
  await preview.screenshot({
    path: `screenshots/qr-preview-your-feature-${testInfo.project.name}.png`,
    animations: 'disabled'
  });
});
```

## Retention

Screenshots are retained for **30 days** in GitHub Actions artifacts.

## Notes

- Screenshots are excluded from git via `.gitignore`
- The `screenshots/` directory is auto-created during test runs
- Screenshots help catch visual regressions before deployment to GitHub Pages
- All screenshots use `animations: 'disabled'` for consistent results
