import * as fs from 'fs';
import * as path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

export function saveCredentialsToEnv(email: string, password: string): void {
  const lines = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, 'utf-8').split('\n').filter(Boolean)
    : [];

  const updated = new Map<string, string>();
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    updated.set(key, rest.join('='));
  }

  updated.set('USERNAME', email);
  updated.set('PASSWORD', password);
  if (!updated.has('BASE_URL')) {
    updated.set('BASE_URL', 'https://zincbank.cydeo.io');
  }

  const content = Array.from(updated.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(ENV_PATH, `${content}\n`);
}
