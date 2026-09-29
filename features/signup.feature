Feature: Account Signup

  @signup
  Scenario: Open a new checking account
    Given I am on the account application page
    When I choose a checking account
    And I continue to the next step
    And I enter my personal details
    And I continue to the next step
    And I enter my identity details
    And I continue to the next step
    And I enter my address details
    And I continue to the next step
    And I set my login password
    And I continue to the next step
    And I accept the terms and submit my application
    Then my account should be created successfully
