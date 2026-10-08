import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

const identity = `qa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const api = 'http://127.0.0.1:59002';
const draft = `clinicId=qa-clinic&serviceId=qa-service&employeeId=qa-employee&branchId=qa-branch&deliveryType=in_person&scheduledAt=${encodeURIComponent(new Date(Date.now() + 864000000).toISOString())}&chargedPrice=12500&currency=SAR`;

test('new booking opens selected card form without another method chooser', async ({ app, device, screen }) => {
  await fetch(`${api}/__reset`, { method: 'POST' });
  await app.open();
  await device.openLink(`sawa://booking/confirm?${draft}`);
  await expect(screen.getByText('طريقة الدفع')).toBeVisible();
  await expect(screen.getByRole('button', 'الدفع بالبطاقات')).toBeVisible();
  await expect(screen.getByRole('button', 'تحويل بنكي')).toBeVisible();
  await expect(screen.getByRole('button', 'تأكيد الموعد والدفع في المركز')).toBeVisible();
  await screen.getByRole('button', 'الدفع بالبطاقات').tap();
  await expect.poll(async () => await screen.getByPlaceholder('الاسم على البطاقة').isVisible() || await screen.getByRole('button', 'استئناف محاولة الدفع').isVisible()).toBeTruthy();
  if (await screen.getByRole('button', 'استئناف محاولة الدفع').isVisible()) await screen.getByRole('button', 'استئناف محاولة الدفع').tap();
  await expect(screen.getByPlaceholder('الاسم على البطاقة')).toBeVisible();
  await expect(screen.getByRole('button', 'الدفع عبر Apple Pay')).not.toBeVisible();
  await expect(screen.getByRole('button', 'الدفع بالبطاقات')).not.toBeVisible();
  await app.screenshot('new-booking-card');
  const events = await fetch(`${api}/__events`).then(r => r.json());
  expect(events.filter((e: { path: string }) => e.path === '/mobile/client/bookings')).toHaveLength(1);
  expect(events.find((e: { path: string }) => e.path === '/mobile/client/payments/native/init').body.method).toBe('ONLINE_CARD');
  await screen.getByRole('button', 'رجوع').tap();
  await expect(screen.getByText('تأكيد الموعد')).toBeVisible();
  await expect(screen.getByText('طريقة الدفع')).toBeVisible();
  await screen.getByRole('button', 'تأكيد الموعد والدفع في المركز').tap();
  await expect(screen.getByText(/لهذا الحجز فاتورة/)).toBeVisible();
  await app.screenshot('existing-invoice-explanation');
  await screen.getByRole('button', 'OK').tap();
  await expect(screen.getByRole('button', 'الدفع بالبطاقات')).toBeVisible();
  await expect(screen.getByText('اختر طريقة الدفع')).not.toBeVisible();
  await screen.getByRole('button', 'الدفع بالبطاقات').tap();
  await expect.poll(async () => await screen.getByPlaceholder('الاسم على البطاقة').isVisible() || await screen.getByRole('button', 'استئناف محاولة الدفع').isVisible()).toBeTruthy();
  const resumedEvents = await fetch(`${api}/__events`).then(r => r.json());
  expect(resumedEvents.filter((e: { path: string }) => e.path === '/mobile/client/bookings')).toHaveLength(1);
});

test('existing appointment opens card form without new booking', async ({ app, device, screen }) => {
  await fetch(`${api}/__reset`, { method: 'POST' });
  await app.open();
  await device.openLink(`sawa://booking/checkout?bookingId=${identity}&invoiceId=${identity}-invoice`);
  await expect(screen.getByRole('button', /متابعة/)).toBeVisible();
  await screen.getByRole('button', /متابعة/).tap();
  await expect.poll(async () => await screen.getByPlaceholder('الاسم على البطاقة').isVisible() || await screen.getByRole('button', 'استئناف محاولة الدفع').isVisible()).toBeTruthy();
  if (await screen.getByRole('button', 'استئناف محاولة الدفع').isVisible()) await screen.getByRole('button', 'استئناف محاولة الدفع').tap();
  await expect(screen.getByPlaceholder('الاسم على البطاقة')).toBeVisible();
  await app.screenshot('existing-booking-card');
  const events = await fetch(`${api}/__events`).then(r => r.json());
  expect(events.filter((e: { path: string }) => e.path === '/mobile/client/bookings')).toHaveLength(0);
});

test('package entry opens card form with one initialization request', async ({ app, device, screen }) => {
  await fetch(`${api}/__reset`, { method: 'POST' });
  await app.open();
  await device.openLink(`sawa://packages/${identity}-family`);
  await expect(screen.getByRole('button', /المتابعة للدفع/)).toBeVisible();
  await screen.getByRole('button', /المتابعة للدفع/).tap();
  await expect.poll(async () => await screen.getByPlaceholder('الاسم على البطاقة').isVisible() || await screen.getByRole('button', 'استئناف محاولة الدفع').isVisible()).toBeTruthy();
  if (await screen.getByRole('button', 'استئناف محاولة الدفع').isVisible()) await screen.getByRole('button', 'استئناف محاولة الدفع').tap();
  await expect(screen.getByPlaceholder('الاسم على البطاقة')).toBeVisible();
  await app.screenshot('package-card');
  const events = await fetch(`${api}/__events`).then(r => r.json());
  expect(events.filter((e: { path: string }) => e.path === '/mobile/client/payments/package-purchases/native/init')).toHaveLength(1);
});


test('new bank transfer booking goes directly to account and receipt screen', async ({ app, device, screen }) => {
  await fetch(`${api}/__reset`, { method: 'POST' });
  await app.open();
  await device.openLink(`sawa://booking/confirm?${draft}&durationOptionId=qa-bank-${identity}`);
  await expect(screen.getByText('طريقة الدفع')).toBeVisible();
  await screen.getByRole('button', 'تحويل بنكي').tap();
  await expect(screen.getByText('QA Bank')).toBeVisible();
  await expect(screen.getByText('QA Center')).toBeVisible();
  await expect(screen.getByRole('button', 'انقر لرفع صورة الإيصال')).toBeVisible();
  await app.screenshot('new-booking-bank-transfer');
  const events = await fetch(`${api}/__events`).then(r => r.json());
  expect(events.filter((e: { path: string }) => e.path === '/mobile/client/bookings')).toHaveLength(1);
  expect(events.some((e: { path: string }) => e.path.includes('/native/init'))).toBe(false);
});

test('fresh at-center booking confirms without online checkout', async ({ app, device, screen }) => {
  await fetch(`${api}/__reset`, { method: 'POST' });
  await app.open();
  await device.openLink(`sawa://booking/confirm?${draft}&durationOptionId=qa-center-${identity}`);
  await expect(screen.getByText('طريقة الدفع')).toBeVisible();
  await screen.getByRole('button', 'تأكيد الموعد والدفع في المركز').tap();
  await expect(screen.getByText('تم تأكيد موعدك')).toBeVisible();
  await app.screenshot('new-booking-at-center');
  const events = await fetch(`${api}/__events`).then(r => r.json());
  const creates = events.filter((e: { path: string }) => e.path === '/mobile/client/bookings');
  expect(creates).toHaveLength(1);
  expect(creates[0].body.payAtClinic).toBe(true);
  expect(events.some((e: { path: string }) => e.path.includes('/native/init'))).toBe(false);
});

test('completed booking removes confirmation from the back stack', async ({ app, device, screen }) => {
  await fetch(`${api}/__reset`, { method: 'POST' });
  await device.closeApp();
  await app.open();
  await device.openLink(`sawa://booking/confirm?${draft}&durationOptionId=qa-complete-${identity}`);
  await expect(screen.getByText('طريقة الدفع')).toBeVisible();
  await screen.getByRole('button', 'الدفع بالبطاقات').tap();
  await expect(screen.getByRole('button', 'التحقق مجددًا')).toBeVisible();
  const events = await fetch(`${api}/__events`).then(r => r.json());
  const initialized = events.find((e: { path: string }) => e.path === '/mobile/client/payments/native/init');
  expect(initialized).toBeDefined();
  await fetch(`${api}/__complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: initialized.body.invoiceId }) });
  await screen.getByRole('button', 'التحقق مجددًا').tap();
  await expect(screen.getByText('تم تأكيد موعدك')).toBeVisible();
  await device.back();
  await expect(screen.getByText('تأكيد الموعد')).not.toBeVisible();
  await expect(screen.getByText('طريقة الدفع')).not.toBeVisible();
  await app.screenshot('completed-booking-back-stack');
});
