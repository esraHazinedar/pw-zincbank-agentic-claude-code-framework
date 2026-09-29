Feature: Dashboard access

  @authenticated @regression
  Scenario: Reuse a stored session instead of logging in again
    Given I have a stored authenticated session
    When I navigate directly to the dashboard
    Then I should see my account dashboard
