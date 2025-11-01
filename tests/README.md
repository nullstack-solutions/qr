# QR Code Testing

## QR Code Validation Tests

This project includes automated tests to ensure QR codes are **fully visible and scannable**.

### Playwright QR Scannability Test

The `tests/e2e/qr-scannable.spec.ts` suite opens the generator, renders several QR variants and decodes the resulting preview with [`jsqr`](https://github.com/cozmo/jsQR). This keeps the entire workflow inside Node.js and mirrors how users interact with the rendered canvas.

#### Local Setup

```bash
npm install
npx playwright install
```

#### Running the scannability checks

```bash
# Run the full E2E suite (includes the scannability spec)
npm run test:e2e

# Or focus on the QR decoder checks only
npx playwright test tests/e2e/qr-scannable.spec.ts --project="Android-like Chromium"
```

#### What the test covers

- Default URL payloads rendered in the preview canvas
- Multiple dot styles and gradient combinations
- Non-Latin text payloads (Cyrillic and emoji)
- Guarantees that the preview canvas remains square and fully visible

All assertions rely on decoding the screenshot pixels, so if the QR code becomes cropped, blurred or otherwise unreadable, the test fails with a clear message.

## CI/CD Integration

GitHub Actions runs the Playwright suite via `npm run test:e2e`. The job surfaces decoded payload mismatches directly in the logs, making scannability regressions easy to spot.
