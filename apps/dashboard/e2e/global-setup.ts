import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const STORAGE_DIR = path.join(__dirname, '..', 'playwright', '.auth');

const PERSONAS = [
  { persona: 'admin',    email: 'admin@sawaa-test.com',          password: 'Admin@1234' },
  { persona: 'receptionist', email: 'receptionist@sawaa-test.com', password: 'Recept@1234' },
  { persona: 'employee', email: 'employee@sawaa-test.com',       password: 'Employee@1234' },
];

async function isServerUp(baseURL: string): Promise<boolean> {
  try {
    const res = await fetch(baseURL, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(baseURL: string, timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerUp(baseURL)) return;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Server ${baseURL} did not become ready within ${timeoutMs}ms`);
}

async function loginAndSave(baseURL: string, email: string, password: string, persona: string) {
  const storagePath = path.join(STORAGE_DIR, `${persona}.json`);
  if (fs.existsSync(storagePath)) {
    console.log(`[global-setup] Auth state already exists for ${persona}, skipping.`);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL, locale: 'ar-SA' });
  const page = await context.newPage();

  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('#identifier').fill(email);
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.getByRole('button', { name: 'باستخدام كلمة المرور' }).click();
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
  await page.locator('header').first().waitFor({ state: 'visible', timeout: 10000 });

  await context.storageState({ path: storagePath });
  console.log(`[global-setup] Auth state saved for ${persona} → ${storagePath}`);

  await browser.close();
}

export default async function globalSetup(config: FullConfig) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  const baseURL = (config.projects[0]?.use?.baseURL as string) ?? 'http://localhost:5203';

  // Start dev server if not already running
  let serverProcess: ReturnType<typeof spawn> | null = null;
  if (!(await isServerUp(baseURL))) {
    console.log('[global-setup] Starting dev server…');
    serverProcess = spawn('pnpm', ['--filter', 'dashboard', 'dev'], {
      cwd: path.join(__dirname, '../..'),
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, NODE_ENV: 'development' },
    });
    serverProcess.unref();
    await waitForServer(baseURL, 120_000);
    console.log('[global-setup] Dev server ready.');
  }

  for (const { persona, email, password } of PERSONAS) {
    await loginAndSave(baseURL, email, password, persona);
  }

  if (serverProcess) {
    console.log('[global-setup] Stopping dev server.');
    serverProcess.kill('SIGTERM');
  }
}
