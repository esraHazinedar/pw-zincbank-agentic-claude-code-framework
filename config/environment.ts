import * as dotenv from 'dotenv';

dotenv.config();

export interface EnvironmentConfig {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
  readonly headless: boolean;
}

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. ${hint}`);
  }
  return value;
}

const SET_IN_ENV = 'Add it to .env in the project root (see README).';
const CREATE_ACCOUNT = `${SET_IN_ENV} No account yet? Run: npm run signup`;

// Getters validate on access, not at import, so the @signup run can start before credentials exist.
export const config: EnvironmentConfig = {
  get baseUrl() {
    return required('BASE_URL', SET_IN_ENV);
  },
  get username() {
    return required('USERNAME', CREATE_ACCOUNT);
  },
  get password() {
    return required('PASSWORD', CREATE_ACCOUNT);
  },
  headless: process.env.HEADLESS !== 'false',
};
