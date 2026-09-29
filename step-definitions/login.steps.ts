import { Given, Then, When } from '@cucumber/cucumber';
import { config } from '../config/environment';
import { LoginPage } from '../pages/LoginPage';
import { CustomWorld } from '../support/world';
import { incorrectPassword } from '../test-data/loginData';

Given('a registered account exists', function (this: CustomWorld) {
  this.loginPage = new LoginPage(this.page);
});

When('I navigate to the sign-in page', async function (this: CustomWorld) {
  await this.loginPage.open(config.baseUrl);
});

When('I enter the registered email and password', async function (this: CustomWorld) {
  await this.loginPage.enterUsername(config.username);
  await this.loginPage.enterPassword(config.password);
});

When('I submit the sign-in form', async function (this: CustomWorld) {
  await this.loginPage.clickLogin();
});

Then('sign-in succeeds and I am redirected to the dashboard', async function (this: CustomWorld) {
  await this.loginPage.expectLoginSuccess();
});

When('I enter the registered email and an incorrect password', async function (this: CustomWorld) {
  await this.loginPage.enterUsername(config.username);
  await this.loginPage.enterPassword(incorrectPassword);
});

Then('sign-in is rejected with a generic error message', async function (this: CustomWorld) {
  await this.loginPage.expectGenericLoginError();
});
