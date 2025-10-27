# QR Code Testing

## QR Code Validation Tests

This project includes automated tests to ensure QR codes are **fully visible and scannable**.

### Python QR Validation Test

The `testValidQrScrenshots.py` test uses the `pyzbar` library to verify that all QR code screenshots contain valid, scannable QR codes with all three finder patterns (corner squares) visible.

#### Local Setup

1. Install Python dependencies:
```bash
pip install -r requirements-test.txt
```

2. On Linux/macOS, install zbar library:
```bash
# Ubuntu/Debian
sudo apt-get install libzbar0

# macOS
brew install zbar
```

3. On Windows, pyzbar should work out of the box after pip install.

#### Running QR Validation Tests

```bash
# Run Playwright tests first to generate screenshots
npm run test:e2e

# Then validate QR codes are scannable
python -m pytest tests/testValidQrScrenshots.py -v
```

#### What the test checks

- All screenshots in the `screenshots/` folder are scanned
- Each QR code must be decodable by pyzbar
- If any QR code cannot be decoded, the test fails with details

This ensures QR codes are not cropped and have proper margin/padding for reliable scanning.

## CI/CD Integration

The QR validation test runs automatically in GitHub Actions after Playwright tests complete. If QR codes are cropped or malformed, the CI pipeline will fail.
