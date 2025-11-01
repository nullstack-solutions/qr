import crypto from 'crypto';
import { test, expect } from '@playwright/test';

function checkInitData(initData: string, botToken: string) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');

  if (!hash) {
    return false;
  }

  urlParams.delete('hash');

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
}

test.describe('initData signature validation', () => {
  test.skip(({ }) => !process.env.BOT_TOKEN || !process.env.TEST_INITDATA, 'BOT_TOKEN and TEST_INITDATA not set');

  test('initData signature is valid', async () => {
    const botToken = process.env.BOT_TOKEN!;
    const testInitData = process.env.TEST_INITDATA!;

    const isValid = checkInitData(testInitData, botToken);

    expect(isValid).toBe(true);
  });

  test('invalid initData signature is rejected', async () => {
    const botToken = process.env.BOT_TOKEN || 'test_token';
    const invalidInitData = 'user=1&hash=0000000000000000000000000000000000000000000000000000000000000000';

    const isValid = checkInitData(invalidInitData, botToken);

    expect(isValid).toBe(false);
  });
});
