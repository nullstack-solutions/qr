export const tgMock = (overrides: Partial<any> = {}) => ({
  WebApp: {
    platform: 'ios',
    colorScheme: 'dark',
    initData: 'user=1&hash=dummy',
    initDataUnsafe: { user: { id: 1, first_name: 'Test' } },
    themeParams: { bg_color: '#000000', text_color: '#ffffff' },
    isExpanded: true,
    viewportHeight: 720,
    viewportStableHeight: 720,
    expand: () => {},
    close: () => {},
    HapticFeedback: { impactOccurred: () => {} },
    MainButton: { isVisible: false, show: () => {}, hide: () => {}, setText: () => {} },
    BackButton: { isVisible: false, show: () => {}, hide: () => {} },
    onEvent: () => {},
    offEvent: () => {},
    sendData: () => {}
  },
  ...overrides
});
