export const tgMock = (overrides: Partial<any> = {}) => ({
  WebApp: {
    platform: 'ios',
    colorScheme: 'light',
    version: '7.0',
    initData: 'user=1&hash=dummy',
    initDataUnsafe: {
      user: {
        id: 1,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'ru'
      }
    },
    themeParams: {
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#6d6d6d',
      link_color: '#3390ec',
      button_color: '#3390ec',
      button_text_color: '#ffffff',
      secondary_bg_color: '#f0f0f0'
    },
    isExpanded: true,
    viewportHeight: 720,
    viewportStableHeight: 720,
    headerColor: '#ffffff',
    backgroundColor: '#ffffff',
    isClosingConfirmationEnabled: false,
    HapticFeedback: {},
    MainButton: {
      isVisible: false,
      isActive: true,
      text: '',
      color: '#3390ec',
      textColor: '#ffffff',
      isProgressVisible: false
    },
    BackButton: {
      isVisible: false
    }
  },
  ...overrides
});
