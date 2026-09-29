const common = [
  'features/**/*.feature',
  '--require-module ts-node/register',
  '--require step-definitions/**/*.ts',
  '--require support/**/*.ts',
  '--format progress',
  '--format json:reports/cucumber-report.json',
  '--format html:reports/cucumber-report.html',
].join(' ');

// @signup creates a real account and rewrites .env, so it only runs via its own profile.
const excludeSignup = '--tags "not @signup"';

module.exports = {
  default: `${common} ${excludeSignup}`,
  smoke: `${common} ${excludeSignup} --tags @smoke`,
  regression: `${common} ${excludeSignup} --tags @regression`,
  signup: `${common} --tags @signup`,
};
