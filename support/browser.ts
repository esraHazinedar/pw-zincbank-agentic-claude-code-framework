import { Browser, chromium } from '@playwright/test';
import { config } from '../config/environment';

let browser: Browser | undefined;

export async function launchBrowser(): Promise<Browser> {
  browser = await chromium.launch({
    headless: config.headless,
  });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = undefined;
  }
}

export function getBrowser(): Browser {
  if (!browser) {
    throw new Error('Browser has not been launched. Did BeforeAll run?');
  }
  return browser;
}
