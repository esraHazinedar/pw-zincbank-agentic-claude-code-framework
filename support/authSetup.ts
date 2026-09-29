import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/environment';
import { LoginPage } from '../pages/LoginPage';

export const STORAGE_STATE_PATH = path.resolve(process.cwd(), '.auth/storageState.json');

export async function ensureAuthenticatedState(): Promise<void> {
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    return;
  }

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginPage = new LoginPage(page);

    await loginPage.open(config.baseUrl);
    await loginPage.login(config.username, config.password);
    await loginPage.expectLoginSuccess();

    fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
    await context.storageState({ path: STORAGE_STATE_PATH });
  } finally {
    await browser.close();
  }
}
