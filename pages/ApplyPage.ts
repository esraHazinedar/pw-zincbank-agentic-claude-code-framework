import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { SignupData } from '../test-data/signupData';

export class ApplyPage extends BasePage {
  private readonly checkingCheckbox: Locator;
  private readonly savingsCheckbox: Locator;
  private readonly continueButton: Locator;
  private readonly submitButton: Locator;
  private readonly stepIndicator: Locator;

  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly emailInput: Locator;
  private readonly phoneInput: Locator;

  private readonly ssnInput: Locator;
  private readonly employmentStatusSelect: Locator;

  private readonly streetInput: Locator;
  private readonly cityInput: Locator;
  private readonly stateSelect: Locator;
  private readonly zipInput: Locator;

  private readonly passwordInput: Locator;
  private readonly confirmPasswordInput: Locator;

  private readonly termsCheckbox: Locator;
  private readonly approvedMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.checkingCheckbox = page.getByRole('checkbox', { name: /Checking account/i });
    this.savingsCheckbox = page.getByRole('checkbox', { name: /savings account/i });
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.submitButton = page.getByRole('button', { name: 'Submit application' });
    this.stepIndicator = page.getByText(/Step \d of \d/);

    this.firstNameInput = page.getByLabel('First name');
    this.lastNameInput = page.getByLabel('Last name');
    this.emailInput = page.getByLabel('Email');
    this.phoneInput = page.getByLabel('Phone');

    this.ssnInput = page.getByLabel(/Social Security/i);
    this.employmentStatusSelect = page.getByLabel(/Employment status/i);

    this.streetInput = page.getByLabel('Street address');
    this.cityInput = page.getByLabel('City');
    this.stateSelect = page.getByLabel('State');
    this.zipInput = page.getByLabel('ZIP code');

    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.confirmPasswordInput = page.getByLabel('Confirm password');

    this.termsCheckbox = page.getByRole('checkbox');
    this.approvedMessage = page.getByText(/You're approved/i);
  }

  async open(baseUrl: string): Promise<void> {
    await this.goto(`${baseUrl}/apply`);
  }

  async chooseCheckingAccount(): Promise<void> {
    if (!(await this.checkingCheckbox.isChecked())) {
      await this.checkingCheckbox.check();
    }
  }

  async chooseSavingsAccount(): Promise<void> {
    await this.savingsCheckbox.check();
  }

  // Waits for the wizard to advance so the next step's fields aren't filled against the old step.
  async continueToNextStep(): Promise<void> {
    const { current, total } = await this.readStep();
    await this.continueButton.click();
    await this.expectOnStep(current + 1, total);
  }

  async fillPersonalDetails(data: SignupData): Promise<void> {
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.emailInput.fill(data.email);
    await this.phoneInput.fill(data.phone);
  }

  async fillIdentityDetails(data: SignupData): Promise<void> {
    await this.ssnInput.fill(data.ssn);
    await this.employmentStatusSelect.selectOption({ label: data.employmentStatus });
  }

  async fillAddressDetails(data: SignupData): Promise<void> {
    await this.streetInput.fill(data.street);
    await this.cityInput.fill(data.city);
    await this.stateSelect.selectOption(data.state);
    await this.zipInput.fill(data.zip);
  }

  async setPassword(data: SignupData): Promise<void> {
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.password);
  }

  async acceptTermsAndSubmit(): Promise<void> {
    await this.termsCheckbox.check();
    await this.submitButton.click();
  }

  async expectOnStep(stepNumber: number, totalSteps: number): Promise<void> {
    await expect(this.stepIndicator).toContainText(`Step ${stepNumber} of ${totalSteps}`);
  }

  async expectApplicationSubmitted(): Promise<void> {
    await expect(this.approvedMessage).toBeVisible();
  }

  private async readStep(): Promise<{ current: number; total: number }> {
    const text = (await this.stepIndicator.textContent()) ?? '';
    const match = text.match(/Step (\d+) of (\d+)/);
    if (!match) {
      throw new Error(`Unexpected wizard step indicator: "${text}"`);
    }
    return { current: Number(match[1]), total: Number(match[2]) };
  }
}
