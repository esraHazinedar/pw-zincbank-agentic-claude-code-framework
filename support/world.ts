import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ApplyPage } from '../pages/ApplyPage';
import { DashboardPage } from '../pages/DashboardPage';
import { SignupData } from '../test-data/signupData';

export class CustomWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  loginPage!: LoginPage;
  applyPage!: ApplyPage;
  dashboardPage!: DashboardPage;
  signupData!: SignupData;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);
