import { Given, Then, When } from '@cucumber/cucumber';
import { config } from '../config/environment';
import { DashboardPage } from '../pages/DashboardPage';
import { CustomWorld } from '../support/world';

Given('I have a stored authenticated session', function (this: CustomWorld) {
  this.dashboardPage = new DashboardPage(this.page);
});

When('I navigate directly to the dashboard', async function (this: CustomWorld) {
  await this.dashboardPage.openDirectly(config.baseUrl);
});

Then('I should see my account dashboard', async function (this: CustomWorld) {
  await this.dashboardPage.expectDashboardVisible();
});
