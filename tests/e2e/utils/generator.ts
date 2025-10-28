import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { tgMock } from '../tg-mock';

const repoBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  process.env.BASE_PATH ??
  (process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}` : '');

const sanitizedBasePath = repoBasePath?.replace(/^\/+/, '').replace(/\/+$/, '') ?? '';
const normalizedBasePath = sanitizedBasePath ? `/${sanitizedBasePath}` : '';

export const APP_URL = process.env.APP_URL ?? `http://localhost:3000${normalizedBasePath}`;

export const urlInputSelector = [
  '[data-testid="qr-input-url"]',
  'input[name="url"]',
  'textarea[name="url"]',
  'label:has-text("Ссылка") + input',
  'input[placeholder*="example.com/page"]'
].join(', ');

export function getUrlInputLocator(page: Page): Locator {
  return page.locator(urlInputSelector).first();
}

export async function openGeneratorTab(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  const generatorTab = page.getByRole('button', { name: /Генератор/ }).first();

  try {
    await generatorTab.waitFor({ state: 'visible', timeout: 30_000 });
    await generatorTab.click();
  } catch (error) {
    await expect(getUrlInputLocator(page)).toBeVisible({ timeout: 30_000 });
  }

  const urlTemplate = page.getByTestId('qr-template-url').first();
  await expect(urlTemplate).toBeVisible({ timeout: 30_000 });
  await urlTemplate.click();

  await expect(getUrlInputLocator(page)).toBeVisible({ timeout: 30_000 });
}

export async function setupGeneratorPage(page: Page, testInfo: TestInfo): Promise<void> {
  if (testInfo.config.workers === 1) {
    page.on('console', (msg) => console.log(`[console:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
  }

  await page.addInitScript(() => {
    try {
      window.localStorage?.clear?.();
    } catch (error) {
      // Ignore storage access issues in environments without localStorage support.
    }
  });

  await page.addInitScript(() => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const deleteDb = (name: string) =>
      new Promise<void>((resolve) => {
        if (!name) {
          resolve();
          return;
        }

        try {
          const request = indexedDB.deleteDatabase(name);
          const finish = () => resolve();
          request.addEventListener('success', finish);
          request.addEventListener('error', finish);
          request.addEventListener('blocked', finish);
        } catch (error) {
          resolve();
        }
      });

    if (typeof indexedDB.databases === 'function') {
      indexedDB
        .databases()
        .then((dbs) => Promise.allSettled(dbs.map((db) => deleteDb(db.name ?? ''))))
        .catch(() => deleteDb('qr-suite'));
    } else {
      deleteDb('qr-suite');
    }
  });

  await page.addInitScript((value: ReturnType<typeof tgMock>) => {
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
      requestContact: stub,
      requestWriteAccess: stub,
      setHeaderColor: stub,
      setBackgroundColor: stub,
      setBottomBarColor: stub,
      setClosingBehavior: stub,
      setNavigationBarColor: stub,
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

    const globalWindow = window as typeof window & { Telegram: ReturnType<typeof tgMock> };
    globalWindow.Telegram = {
      ...value,
      WebApp: stubbedWebApp
    };
  }, tgMock());
}
