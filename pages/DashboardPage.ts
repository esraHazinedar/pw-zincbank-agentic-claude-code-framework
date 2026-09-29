import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  private readonly welcomeHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeHeading = page.getByRole('heading', { name: /^Welcome,/ });
  }

  async openDirectly(baseUrl: string): Promise<void> {
    await this.goto(`${baseUrl}/dashboard`);
  }

  async expectDashboardVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard$/);
    await expect(this.welcomeHeading).toBeVisible();
  }
}
