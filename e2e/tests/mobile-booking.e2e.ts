import { test } from '@e2e-dev/mobile';
import { credentials, expect } from 'e2e';
import { fixture, verifyBooking } from '../local/verify.mjs';

test('SW-M01 native client signs in and books pay at center', {
  tags: ['mobile', 'booking'], platforms: ['ios'], requires: ['device'],
}, async ({ app, device, screen }) => {
  const f = fixture();
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
  await screen.getByRole('button', 'العيادات', { exact: true }).tap();
  await screen.getByTestId(`clinic-${f.clinicId}`).tap();
  await screen.getByRole('button', 'جلسة اختبار أسرية', { exact: true }).tap();
  // The only eligible practitioner is selected by the app automatically.
  await screen.getByLabel(/موعد عيادة/).tap();
  const date = new Date(f.appointments.mobile);
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
  await screen.scrollUntilVisible(screen.getByLabel(/الدفع في المركز/));
  await screen.getByLabel(/الدفع في المركز/).tap();
  await screen.getByRole('button', 'تأكيد الحجز').tap();
  await expect.poll(() => verifyBooking('mobile'), { timeout: 30_000 }).toMatchObject({ status: 'CONFIRMED' });
  await expect(screen.getByText('تم تأكيد موعدك', { exact: true })).toBeVisible({ timeout: 30_000 });
});
