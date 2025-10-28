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

    // Apply theme parameters - TMA Premium Design System
    const applyTheme = () => {
      const theme = WebApp.themeParams;
      const root = document.documentElement;

      // TMA Premium Design System variables
      root.style.setProperty('--bg', theme.bg_color || '#ffffff');
      root.style.setProperty('--text', theme.text_color || '#000000');
      root.style.setProperty('--hint', theme.hint_color || '#6d6d6d');
      root.style.setProperty('--accent', theme.link_color || '#3390ec');
      root.style.setProperty('--surface', theme.secondary_bg_color || '#f0f0f0');
      root.style.setProperty('--button', theme.button_color || '#3390ec');
      root.style.setProperty('--destructive', theme.destructive_text_color || '#ff3b30');
      root.style.setProperty('--surface-border', theme.secondary_bg_color || 'rgba(12, 33, 66, 0.1)');

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
