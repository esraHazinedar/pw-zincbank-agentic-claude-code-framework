import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly signInButton: Locator;
  private readonly welcomeHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByPlaceholder('you@example.com');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.welcomeHeading = page.getByRole('heading', { name: /^Welcome,/ });
  }

  async open(baseUrl: string): Promise<void> {
    await this.goto(`${baseUrl}/login`);
  }

  async enterUsername(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async clickLogin(): Promise<void> {
    await this.signInButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.enterUsername(email);
    await this.enterPassword(password);
    await this.clickLogin();
  }

  async expectLoginSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard$/);
    await expect(this.welcomeHeading).toBeVisible();
  }
}
