import { AfterAll, After, Before, BeforeAll, setDefaultTimeout, Status } from '@cucumber/cucumber';
import * as path from 'path';
import { ensureAuthenticatedState, STORAGE_STATE_PATH } from './authSetup';
import { closeBrowser, getBrowser, launchBrowser } from './browser';
import { CustomWorld } from './world';

// Cucumber's 5s default is too tight for page loads against the live site.
setDefaultTimeout(15_000);

BeforeAll(async function () {
  await launchBrowser();
});

AfterAll(async function () {
  await closeBrowser();
});

// 30s timeout: the first @authenticated scenario may perform a real network login.
Before({ timeout: 30_000 }, async function (this: CustomWorld, { pickle }) {
  this.browser = getBrowser();

  const useStoredSession = pickle.tags.some((tag) => tag.name === '@authenticated');
  if (useStoredSession) {
    await ensureAuthenticatedState();
  }
  this.context = await this.browser.newContext(
    useStoredSession ? { storageState: STORAGE_STATE_PATH } : undefined,
  );
  this.page = await this.context.newPage();
});

After(async function (this: CustomWorld, { result, pickle }) {
  if (result && result.status === Status.FAILED && this.page) {
    const scenarioName = pickle.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const screenshotPath = path.join('screenshots', `failed-${scenarioName}.png`);
    const screenshot = await this.page.screenshot({ path: screenshotPath, fullPage: true });
    await this.attach(screenshot, 'image/png');
  }

  if (this.context) {
    await this.context.close();
  }
});
