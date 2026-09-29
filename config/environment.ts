import * as dotenv from 'dotenv';

dotenv.config();

export type TraceMode = 'off' | 'on' | 'retain-on-failure';

export interface EnvironmentConfig {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
  readonly headless: boolean;
  readonly trace: TraceMode;
}

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. ${hint}`);
  }
  return value;
}

function traceMode(): TraceMode {
  const value = process.env.TRACE || 'retain-on-failure';
  if (value !== 'off' && value !== 'on' && value !== 'retain-on-failure') {
    throw new Error(`Invalid TRACE value "${value}". Use off, on, or retain-on-failure.`);
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
  trace: traceMode(),
};
