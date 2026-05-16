import { test as setup, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = path.join(__dirname, '..', '..', 'playwright', '.auth');
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const BASE_URL = process.env.PW_DASHBOARD_URL ?? 'http://localhost:5203';

async function loginAndSave(email: string, password: string, outPath: string) {
  if (fs.existsSync(outPath)) {
    console.log(`[setup] Auth state already exists → ${outPath}`);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL, locale: 'ar-SA' });
  const page = await context.newPage();

  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('#identifier').fill(email);
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.getByRole('button', { name: 'باستخدام كلمة المرور' }).click();
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
  await page.locator('header').first().waitFor({ state: 'visible', timeout: 10000 });

  await context.storageState({ path: outPath });
  console.log(`[setup] Auth state saved → ${outPath}`);

  await browser.close();
}

setup('authenticate as admin', async () => {
  await loginAndSave(
    'admin@sawaa-test.com',
    'Admin@1234',
    path.join(STORAGE_DIR, 'admin.json'),
  );
});

setup('authenticate as receptionist', async () => {
  await loginAndSave(
    'receptionist@sawaa-test.com',
    'Recept@1234',
    path.join(STORAGE_DIR, 'receptionist.json'),
  );
});
