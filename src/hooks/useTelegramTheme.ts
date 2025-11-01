'use client';

import { useEffect, useState } from 'react';
import { TelegramThemeParams, TelegramWebApp } from '@/types/telegram';
import '@/types/telegram';

const getTelegramWebApp = (): TelegramWebApp | undefined =>
  (typeof window === 'undefined' ? undefined : window.Telegram?.WebApp);

export function useTelegramTheme() {
  const [theme, setTheme] = useState<TelegramThemeParams>(() => getTelegramWebApp()?.themeParams ?? {});
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(
    () => getTelegramWebApp()?.colorScheme ?? 'light'
  );

  const webApp = getTelegramWebApp();

  useEffect(() => {
    if (!webApp) {
      return;
    }

    const updateTheme = () => {
      setTheme({ ...webApp.themeParams });
      setColorScheme(webApp.colorScheme);
    };

    updateTheme();
    webApp.onEvent?.('themeChanged', updateTheme);

    return () => {
      webApp.offEvent?.('themeChanged', updateTheme);
    };
  }, [webApp]);

  return {
    theme,
    colorScheme,
    isAvailable: Boolean(webApp),
    platform: webApp?.platform ?? 'unknown'
  };
}
