import assert from 'node:assert/strict';
import { test } from '@e2e-dev/mobile';
import { credentials, expect } from 'e2e';
import { fixture, verifyBooking } from '../local/verify.mjs';

test('SW-M02 native card form declines then retries one Sandbox booking', {
  tags: ['mobile', 'payment'], platforms: ['ios'], requires: ['device'],
}, async ({ app, device, screen }) => {
  const f = fixture();
  assert.equal(process.env.BACKEND_URL, 'http://127.0.0.1:55200');
  const login = await fetch(`${process.env.BACKEND_URL}/api/v1/mobile/auth/password-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: f.clients.payment.email, password: process.env.E2E_USER_CLIENT_PASSWORD }),
  });
  assert.ok(login.ok, `Fixture login HTTP ${login.status}`);
  const session = await login.json();
  const auth = { Authorization: `Bearer ${session.tokens.accessToken}` };
  const configResponse = await fetch(`${process.env.BACKEND_URL}/api/v1/mobile/client/payments/native/config`, { headers: auth });
  assert.ok(configResponse.ok);
  const config = await configResponse.json();
  assert.ok(config.enabled === true && config.isLive === false, 'Only enabled Sandbox is allowed');
  const existingResponse = await fetch(`${process.env.BACKEND_URL}/api/v1/mobile/client/bookings?limit=1`, { headers: auth });
  assert.ok(existingResponse.ok);
  const existing = await existingResponse.json();
  const resumeId = process.env.E2E_RESUME_BOOKING_ID;
  if (resumeId) {
    assert.equal(existing.meta.total, 1);
    assert.equal(existing.items[0].id, resumeId);
    assert.equal(existing.items[0].status, 'awaiting_payment');
    await verifyBooking('payment', 'AWAITING_PAYMENT');
  } else assert.equal(existing.meta.total, 0, 'Use a fresh fixture; never duplicate an ambiguous booking');
  await device.installApp(undefined, { reinstall: true });
  await app.open();
  const openPrompt = screen.getByRole('button', 'Open', { exact: true });
  if (await openPrompt.count()) await openPrompt.tap();
  await expect(screen.getByRole('button', 'العيادات', { exact: true })).toBeVisible({ timeout: 30_000 });
  await screen.getByRole('button', 'تسجيل الدخول', { exact: true }).tap();
  const identifier = screen.getByRole('textbox', 'البريد الإلكتروني أو رقم الجوال', { exact: true });
  const client = credentials.user('mobile');
  await identifier.fill(client.username);
  await device.dismissKeyboard();
  await screen.getByRole('textbox', 'كلمة المرور', { exact: true }).fill(client.password);
  await device.dismissKeyboard();
  await screen.getByRole('button', 'سجّل دخولك').tap();
  // iOS may offer to save the synthetic password after successful login.
  await expect.poll(async () => (await screen.getByRole('button', 'Not Now', { exact: true }).count())
    || (await screen.getByRole('button', 'العيادات', { exact: true }).count()), { timeout: 30_000 }).toBeGreaterThan(0);
  const savePrompt = screen.getByRole('button', 'Not Now', { exact: true });
  if (await savePrompt.count()) await savePrompt.tap();
  await expect(screen.getByRole('button', 'العيادات', { exact: true })).toBeVisible({ timeout: 30_000 });
  if (resumeId) {
    await device.openLink(`sawa://payments/native-checkout?invoiceId=${existing.items[0].invoice.id}&bookingId=${resumeId}&method=ONLINE_CARD`);
  } else {
  await screen.getByRole('button', 'العيادات', { exact: true }).tap();
  await screen.getByTestId(`clinic-${f.clinicId}`).tap();
  await screen.getByRole('button', 'جلسة اختبار أسرية', { exact: true }).tap();
  // The only eligible practitioner is selected by the app automatically.
  await screen.getByLabel(/موعد عيادة/).tap();
  const date = new Date(f.appointments.payment);
  const dateLabel = new Intl.DateTimeFormat('ar-SA', { timeZone: 'Asia/Riyadh', calendar: 'gregory', dateStyle: 'full' }).format(date);
  // The retained Debug artifact's native Intl may render the default Hijri
  // calendar despite the current JS calendar option. Both labels bind the
  // same exact date; the DB assertion below always checks its ISO timestamp.
  const nativeDateLabel = new Intl.DateTimeFormat('ar-SA', { timeZone: 'Asia/Riyadh', calendar: 'islamic-umalqura', dateStyle: 'full' }).format(date);
  const datePattern = new RegExp(`^(?:${[dateLabel, nativeDateLabel].map(label =>
    label.replaceAll('،', ' ').trim().split(/\s+/).join('[\\s،]+')).join('|')})$`);
  await screen.getByLabel(datePattern).tap();
  const slotLabel = `وقت ${new Intl.DateTimeFormat('ar-SA', { timeZone: 'Asia/Riyadh', calendar: 'gregory', hour: 'numeric', minute: '2-digit' }).format(date)}`;
  await screen.getByLabel(slotLabel, { exact: true }).tap();
  await screen.getByRole('button', 'متابعة').tap();
  await screen.scrollUntilVisible(screen.getByLabel('البطاقات', { exact: true }));
  await screen.getByLabel('البطاقات', { exact: true }).tap();
  await screen.getByRole('button', 'ادفع ٣٠٠٫٠٠ ر.س', { exact: true }).tap();
  }
  const card = screen.getByPlaceholder('رقم البطاقة', { exact: true });
  await expect(card).toBeVisible({ timeout: 30_000 });
  const createdReceipt = await verifyBooking('payment', 'AWAITING_PAYMENT');
  async function attempts() {
    const response = await fetch(`${process.env.BACKEND_URL}/api/v1/mobile/client/payments/invoices/${createdReceipt.invoices[0].id}`, { headers: auth });
    assert.ok(response.ok);
    return (await response.json()).payments as Array<{ status: string; amount: string | number }>;
  }
  async function fillCard(number: string) {
    await screen.getByPlaceholder('الاسم على البطاقة', { exact: true }).fill('Test Client');
    await device.dismissKeyboard();
    await card.fill(number.match(/.{1,4}/g)!.join(' '));
    await device.dismissKeyboard();
    await screen.getByPlaceholder('تاريخ الانتهاء (شهر/سنة)', { exact: true }).fill(`12 / ${String(new Date().getUTCFullYear() + 2).slice(-2)}`);
    await device.dismissKeyboard();
    await screen.getByPlaceholder('رمز الأمان', { exact: true }).fill('123');
    await device.dismissKeyboard();
    await screen.getByLabel(/^ادفع/).tap();
  }
  async function finishTestChallenge(outcome: string) {
    const submit = screen.getByRole('button', 'Submit', { exact: true });
    await expect.poll(async () => (await submit.count())
      || (await screen.getByText(outcome, { exact: true }).count()), { timeout: 45_000 }).toBeGreaterThan(0);
    if (await submit.count()) await submit.tap();
  }
  // Official declined Visa; all card values are synthetic test data.
  await fillCard('4123120001090109');
  await finishTestChallenge('لم تكتمل محاولة الدفع. يمكنك بدء محاولة جديدة.');
  await expect(screen.getByText('لم تكتمل محاولة الدفع. يمكنك بدء محاولة جديدة.', { exact: true })).toBeVisible({ timeout: 45_000 });
  await verifyBooking('payment', 'AWAITING_PAYMENT');
  assert.equal((await attempts()).filter(p => p.status === 'FAILED').length, 1);
  assert.equal((await attempts()).filter(p => p.status === 'COMPLETED').length, 0);
  await screen.getByRole('button', 'إعادة المحاولة', { exact: true }).tap();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await fillCard('4111114005765430');
  await finishTestChallenge('تم تأكيد موعدك');
  await expect.poll(() => verifyBooking('payment'), { timeout: 60_000 }).toMatchObject({ status: 'CONFIRMED' });
  const finalAttempts = await attempts();
  assert.equal(finalAttempts.filter(p => p.status === 'FAILED').length, 1);
  assert.equal(finalAttempts.filter(p => p.status === 'COMPLETED').length, 1);
  assert.equal(finalAttempts.length, 2);
  await expect(screen.getByText('تم تأكيد موعدك', { exact: true })).toBeVisible({ timeout: 30_000 });
});
