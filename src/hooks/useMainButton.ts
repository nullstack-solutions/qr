'use client';

import { useEffect, useCallback } from 'react';
import '@/types/telegram';

interface UseMainButtonOptions {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
  textColor?: string;
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
}

export function useMainButton({
  text,
  onClick,
  disabled = false,
  color,
  textColor,
  hapticFeedback = 'medium'
}: UseMainButtonOptions) {
  const handleClick = useCallback(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(hapticFeedback);
    }
    onClick();
  }, [onClick, hapticFeedback]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      return;
    }

    const MainButton = window.Telegram.WebApp.MainButton;

    // Configure button
    MainButton.setParams({
      text,
      color,
      text_color: textColor,
      is_active: !disabled,
      is_visible: true
    });

    // Show button
    MainButton.show();

    if (disabled) {
      MainButton.disable();
    } else {
      MainButton.enable();
    }

    // Attach click handler
    MainButton.onClick(handleClick);

    // Cleanup
    return () => {
      MainButton.offClick(handleClick);
      MainButton.hide();
    };
  }, [text, disabled, color, textColor, handleClick]);

  return {
    isAvailable: typeof window !== 'undefined' && !!window.Telegram?.WebApp
  };
}
