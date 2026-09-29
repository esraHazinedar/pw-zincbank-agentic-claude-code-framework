import { AfterAll, After, Before, BeforeAll, setDefaultTimeout, Status } from '@cucumber/cucumber';
import * as path from 'path';
import { config } from '../config/environment';
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
  if (config.trace !== 'off') {
    await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }
  this.page = await this.context.newPage();
});

After(async function (this: CustomWorld, { result, pickle }) {
  const failed = result?.status === Status.FAILED;
  const scenarioName = pickle.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  if (failed && this.page) {
    const screenshotPath = path.join('screenshots', `failed-${scenarioName}.png`);
    const screenshot = await this.page.screenshot({ path: screenshotPath, fullPage: true });
    await this.attach(screenshot, 'image/png');
  }

  if (this.context && config.trace !== 'off') {
    if (config.trace === 'on' || failed) {
      const tracePath = path.join('reports', 'traces', `${scenarioName}.zip`);
      await this.context.tracing.stop({ path: tracePath });
      console.log(`\nTrace saved: ${tracePath}`);
    } else {
      await this.context.tracing.stop();
    }
  }

  if (this.context) {
    await this.context.close();
  }
});
