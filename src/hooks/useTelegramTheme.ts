'use client';

import { useEffect, useState } from 'react';
import { TelegramThemeParams } from '@/types/telegram';
import '@/types/telegram';

export function useTelegramTheme() {
  const [theme, setTheme] = useState<TelegramThemeParams>({});
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      setIsAvailable(false);
      return;
    }

    setIsAvailable(true);
    const WebApp = window.Telegram.WebApp;

    setTheme(WebApp.themeParams);
    setColorScheme(WebApp.colorScheme);
  }, []);

  return {
    theme,
    colorScheme,
    isAvailable,
    platform: typeof window !== 'undefined' && window.Telegram?.WebApp
      ? window.Telegram.WebApp.platform
      : 'unknown'
  };
}
