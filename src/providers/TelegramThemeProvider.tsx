'use client';

import { useEffect, ReactNode } from 'react';
import '@/types/telegram';

interface TelegramThemeProviderProps {
  children: ReactNode;
}

export function TelegramThemeProvider({ children }: TelegramThemeProviderProps) {
  useEffect(() => {
    // Check if running inside Telegram
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      console.log('Not running in Telegram WebApp, using default theme');
      return;
    }

    const WebApp = window.Telegram.WebApp;

    // Initialize Telegram WebApp
    WebApp.ready();
    WebApp.expand();

    // Apply theme parameters
    const applyTheme = () => {
      const theme = WebApp.themeParams;
      const root = document.documentElement;

      // Set CSS custom properties
      root.style.setProperty('--tg-bg', theme.bg_color || '#ffffff');
      root.style.setProperty('--tg-text', theme.text_color || '#000000');
      root.style.setProperty('--tg-hint', theme.hint_color || 'rgba(0, 0, 0, 0.5)');
      root.style.setProperty('--tg-link', theme.link_color || '#3390ec');
      root.style.setProperty('--tg-button', theme.button_color || '#3390ec');
      root.style.setProperty('--tg-button-text', theme.button_text_color || '#ffffff');
      root.style.setProperty('--tg-secondary', theme.secondary_bg_color || '#f0f0f0');
      root.style.setProperty('--tg-header-bg', theme.header_bg_color || '#ffffff');
      root.style.setProperty('--tg-accent', theme.accent_text_color || '#3390ec');
      root.style.setProperty('--tg-section-bg', theme.section_bg_color || '#ffffff');
      root.style.setProperty('--tg-section-header', theme.section_header_text_color || '#6d6d72');
      root.style.setProperty('--tg-subtitle', theme.subtitle_text_color || '#999999');
      root.style.setProperty('--tg-destructive', theme.destructive_text_color || '#ff3b30');

      // Set color scheme
      root.style.setProperty('color-scheme', WebApp.colorScheme);
    };

    // Initial theme application
    applyTheme();

    // Listen for theme changes
    const handleThemeChange = () => {
      applyTheme();
    };

    WebApp.onEvent('themeChanged', handleThemeChange);

    // Cleanup
    return () => {
      WebApp.offEvent('themeChanged', handleThemeChange);
    };
  }, []);

  return <>{children}</>;
}
