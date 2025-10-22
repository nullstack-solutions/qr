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
    ready: () => {},
    expand: () => {},
    close: () => {},
    enableClosingConfirmation: () => {},
    disableClosingConfirmation: () => {},
    HapticFeedback: {
      impactOccurred: (style: string) => {},
      notificationOccurred: (type: string) => {},
      selectionChanged: () => {}
    },
    MainButton: {
      isVisible: false,
      isActive: true,
      text: '',
      color: '#3390ec',
      textColor: '#ffffff',
      isProgressVisible: false,
      show: () => {},
      hide: () => {},
      setText: (text: string) => {},
      enable: () => {},
      disable: () => {},
      showProgress: () => {},
      hideProgress: () => {},
      setParams: (params: any) => {},
      onClick: (callback: Function) => {},
      offClick: (callback: Function) => {}
    },
    BackButton: {
      isVisible: false,
      show: () => {},
      hide: () => {},
      onClick: (callback: Function) => {},
      offClick: (callback: Function) => {}
    },
    onEvent: (eventType: string, callback: Function) => {},
    offEvent: (eventType: string, callback: Function) => {},
    sendData: (data: string) => {},
    openLink: (url: string) => {},
    openTelegramLink: (url: string) => {},
    showPopup: (params: any, callback?: Function) => {},
    showAlert: (message: string, callback?: Function) => {},
    showConfirm: (message: string, callback?: Function) => {},
    showScanQrPopup: (params: any, callback?: Function) => {},
    closeScanQrPopup: () => {},
    readTextFromClipboard: (callback?: Function) => {}
  },
  ...overrides
});
