import { remote } from 'webdriverio';

const caps = {
  'platformName': 'android',
  'appium:deviceName': 'Google Pixel 7',
  'appium:platformVersion': '14.0',
  'appium:automationName': 'UiAutomator2',
  'bstack:options': {
    projectName: 'qr-suite-telegram',
    buildName: 'android-e2e'
  },
  'appium:appPackage': 'org.telegram.messenger',
  'appium:noReset': true
};

const main = async () => {
  console.log('Connecting to BrowserStack...');

  const driver = await remote({
    hostname: 'hub.browserstack.com',
    path: '/wd/hub',
    port: 443,
    protocol: 'https',
    capabilities: caps,
    user: process.env.BROWSERSTACK_USERNAME,
    key: process.env.BROWSERSTACK_ACCESS_KEY
  });

  try {
    console.log('Opening Telegram deeplink...');

    // Open deeplink to Telegram bot
    await driver.execute('mobile: deepLink', {
      url: process.env.TG_BOT_DEEPLINK,
      package: 'org.telegram.messenger'
    });

    // Wait for app to load
    await driver.pause(5000);

    // Get available contexts
    const contexts = await driver.getContexts();
    console.log('Available contexts:', contexts);

    // Find WebView context
    const webview = contexts.find(c => c.includes('WEBVIEW'));

    if (!webview) {
      throw new Error('WEBVIEW not found. Available contexts: ' + contexts.join(', '));
    }

    console.log('Switching to WebView:', webview);
    await driver.switchContext(webview);

    // Check if mini app loaded
    const el = await driver.$('body');
    await el.waitForExist({ timeout: 10000 });

    console.log('Mini app loaded successfully!');

    // Additional checks can be added here
    const pageTitle = await driver.getTitle();
    console.log('Page title:', pageTitle);

  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await driver.deleteSession();
  }
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
