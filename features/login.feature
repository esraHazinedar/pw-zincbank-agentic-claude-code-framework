Feature: Sign in

  @smoke @ZTM-5
  Scenario: ZTM-5: successful sign-in redirects to the dashboard
    Given a registered account exists
    When I navigate to the sign-in page
    And I enter the registered email and password
    And I submit the sign-in form
    Then sign-in succeeds and I am redirected to the dashboard
