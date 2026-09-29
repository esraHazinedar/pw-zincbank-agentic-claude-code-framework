import { Given, Then, When } from '@cucumber/cucumber';
import { config } from '../config/environment';
import { ApplyPage } from '../pages/ApplyPage';
import { CustomWorld } from '../support/world';
import { generateSignupData } from '../test-data/signupData';
import { saveCredentialsToEnv } from '../utils/envWriter';

Given('I am on the account application page', async function (this: CustomWorld) {
  this.applyPage = new ApplyPage(this.page);
  await this.applyPage.open(config.baseUrl);
});

When('I choose a checking account', async function (this: CustomWorld) {
  await this.applyPage.chooseCheckingAccount();
});

When('I continue to the next step', async function (this: CustomWorld) {
  await this.applyPage.continueToNextStep();
});

When('I enter my personal details', async function (this: CustomWorld) {
  this.signupData = generateSignupData();
  await this.applyPage.fillPersonalDetails(this.signupData);
});

When('I enter my identity details', async function (this: CustomWorld) {
  await this.applyPage.fillIdentityDetails(this.signupData);
});

When('I enter my address details', async function (this: CustomWorld) {
  await this.applyPage.fillAddressDetails(this.signupData);
});

When('I set my login password', async function (this: CustomWorld) {
  await this.applyPage.setPassword(this.signupData);
});

When('I accept the terms and submit my application', async function (this: CustomWorld) {
  await this.applyPage.acceptTermsAndSubmit();
});

Then('my account should be created successfully', async function (this: CustomWorld) {
  await this.applyPage.expectApplicationSubmitted();
  saveCredentialsToEnv(this.signupData.email, this.signupData.password);
});
