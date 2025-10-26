# E2E тесты для Telegram Mini App

Этот проект содержит e2e тесты для Telegram Mini App с использованием Playwright.

## Структура

- `tg-mock.ts` - Мок объекта Telegram WebApp API
- `smoke.spec.ts` - Базовые smoke-тесты приложения
- `initdata.contract.spec.ts` - Контракт-тесты для проверки подписи initData

## Локальный запуск

### Предварительные требования

```bash
npm install
npx playwright install --with-deps
```

### Запуск тестов

```bash
# Запуск всех e2e тестов
npm run test:e2e

# Запуск с UI режимом
npx playwright test --ui

# Запуск конкретного теста
npx playwright test smoke.spec.ts

# Просмотр отчета
npm run test:e2e:report
```

### Переменные окружения

- `APP_URL` - URL приложения (по умолчанию: http://localhost:3000)
- `BOT_TOKEN` - Токен Telegram бота (для тестов подписи initData)
- `TEST_INITDATA` - Тестовые данные initData с валидной подписью

## Запуск в Docker

```bash
# Сборка образа
docker build -t qr-suite-tests .

# Запуск тестов
docker run --rm \
  -e APP_URL=http://host.docker.internal:3000 \
  -e BOT_TOKEN=your_bot_token \
  -e TEST_INITDATA='your_test_data' \
  qr-suite-tests
```

## CI/CD

Тесты автоматически запускаются в GitHub Actions при каждом push в ветки `test` и `main`.

### Настройка секретов в GitHub

1. Перейдите в Settings → Secrets and variables → Actions
2. Добавьте следующие секреты:
   - `APP_URL` - URL задеплоенного приложения (опционально)
   - `BOT_TOKEN` - Токен вашего Telegram бота
   - `TEST_INITDATA` - Валидные тестовые данные initData

## BrowserStack (опционально)

Для тестирования в реальном Telegram используйте workflow `appium-browserstack`:

1. Добавьте секреты:
   - `BROWSERSTACK_USERNAME`
   - `BROWSERSTACK_ACCESS_KEY`
   - `TG_BOT_DEEPLINK` - deeplink к вашему боту (https://t.me/your_bot?startapp=payload)

2. Запустите workflow вручную из GitHub Actions

## Конфигурация

Настройка тестов находится в `playwright.config.ts`:
- Таймауты
- Устройства для эмуляции (iPhone 14, Pixel 7)
- Настройки трейсов и видео
- Web Server для автоматического запуска Next.js
