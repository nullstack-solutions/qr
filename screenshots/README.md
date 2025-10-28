# QR preview screenshots

The Playwright E2E suite renders several preview variants and saves their screenshots to this directory during CI runs.
The repository keeps the folder for documentation only—no binary or encoded images are committed.

To refresh the screenshots locally before running the validation test:

```bash
npm install
npx playwright install
QR_SCREENSHOTS_PREP="npm run pretest:e2e" npx playwright test tests/e2e/qr-preview-screenshots.spec.ts --reporter=line
```

Alongside every `.png` file the Playwright suite stores a `.png.json` metadata file describing the QR canvas location and the
device pixel ratio used during capture. The validation test uses this metadata to crop the generated screenshots precisely and
prove that each rendered QR remains scannable.

All generated assets remain ignored by Git. The Python test `tests/testValidQrScrenshots.py` expects the screenshots to be
present and fails with a helpful message if they are missing so that the pipeline clearly indicates when generation did not run.
