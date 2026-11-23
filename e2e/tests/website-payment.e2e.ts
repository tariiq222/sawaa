import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from '@e2e-dev/web';
import { credentials, expect } from 'e2e';
import { fixture, verifyBooking, verifyHostedPayment } from '../local/verify.mjs';
import { isTarget, websiteUrl } from '../urls.ts';

const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Exact hosts only; no wildcards. Everything else is aborted and recorded (host only).
const LOCAL_HOSTS = ['127.0.0.1:55200', '127.0.0.1:55205'];
// checkout.moyasar.com loads its card-form SDK from cdn.jsdelivr.net; analytics, fonts and tag managers stay blocked.
// Provider and CDN hosts are only allowed over https; the local stack stays plain http.
const MOYASAR_HOSTS = ['checkout.moyasar.com', 'api.moyasar.com', 'cdn.jsdelivr.net'];
const permits = (url: URL): boolean => url.protocol === 'https:'
  ? MOYASAR_HOSTS.includes(url.host)
  : url.protocol === 'http:' && LOCAL_HOSTS.includes(url.host);
const SETTLE_TIMEOUT_MS = 90_000;
// e2e/local/webhook.mjs binds a plain HTTP server to 127.0.0.1:55207 that answers 404
// on every request except its random POST path.
const RELAY_PROBE_URL = 'http://127.0.0.1:55207/';
const RELAY_PROBE_TIMEOUT_MS = 5_000;
const sleep = (ms: number) => new Promise<void>(ok => setTimeout(ok, ms));

type HostedReceipt = {
  createdAt?: string; webhookBaseline?: number;
  cardSubmitted?: boolean; cardSubmittedAt?: string;
  bookingId?: string; invoiceId?: string; paymentId?: string;
  bookingStatus?: string; invoiceStatus?: string; paymentStatus?: string;
  amountHalalas?: number; currency?: string; payAtClinic?: boolean;
  settledAt?: string; settledAfterCardMs?: number;
  webhook?: { deliveries: number; paidDeliveries: Array<{ eventType: string; httpStatus: number; skipped: boolean; afterCardMs: number | null }> };
  blockedHosts?: string[]; allowedHosts?: string[]; usedHosts?: string[];
  outcome?: 'passed' | 'failed'; failedStep?: string; note?: string;
};

test('SW-P03 website books a SERVICES clinic and pays by card on Moyasar Sandbox hosted checkout', {
  tags: ['payment-hosted', 'website'], requires: ['browser'],
}, async ({ app, screen, browser }) => {
  test.skip(!isTarget(app.baseUrl, websiteUrl), 'website only');
  const f = fixture(); // Rejects any invocation outside the isolated local database.
  const runDir = process.env.E2E_LOCAL_RUN_DIR!;
  const backend = process.env.BACKEND_URL!;
  const receiptPath = resolve(runDir, 'hosted-payment-receipt.json'); // hosted-receipt.json is owned by verifyBooking
  const webhookPath = resolve(runDir, 'webhook-receipt.json');
  const hosted = f.clients.hosted;
  let step = 'prechecks';
  const allowed = new Set([...LOCAL_HOSTS, ...MOYASAR_HOSTS]);
  let blocked = new Set<string>();
  let used = new Set<string>();
  let networkReady = false;
  // A host that was only ever reached with a rejected scheme never appears in `used`.
  const persistNetwork = () => saveReceipt({ blockedHosts: [...blocked].filter(host => !used.has(host)).sort(), allowedHosts: [...allowed].sort(), usedHosts: [...used].sort() });

  const readReceipt = (): HostedReceipt => (existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : {});
  const saveReceipt = (patch: HostedReceipt): HostedReceipt => {
    const merged = { ...readReceipt(), ...patch };
    writeFileSync(receiptPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
    return merged;
  };
  const withDb = async <T>(run: (prisma: any) => Promise<T>): Promise<T> => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    try { return await run(prisma); } finally { await prisma.$disconnect(); }
  };
  const readState = () => withDb(async prisma => {
    const bookings = await prisma.booking.findMany({ where: { clientId: hosted.id }, select: { id: true, status: true } });
    if (bookings.length !== 1) return { bookings, invoiceId: null as string | null, payments: 0 };
    const invoice = await prisma.invoice.findFirst({ where: { bookingId: bookings[0].id }, select: { id: true, payments: { select: { id: true } } } });
    return { bookings, invoiceId: (invoice?.id ?? null) as string | null, payments: (invoice?.payments.length ?? 0) as number };
  });
  const webhookReceipt = () => JSON.parse(readFileSync(webhookPath, 'utf8')) as {
    registeredId: string | null; deleted: boolean;
    deliveries: Array<{ eventType: string; receivedAt: string; httpStatus: number; skipped: boolean }>;
  };

  try {
    // 1. No-side-effect prechecks: nothing below creates a booking or contacts the provider.
    assert.equal(new URL(websiteUrl).origin, 'http://127.0.0.1:55205', 'Hosted payment test requires the isolated website');
    assert.equal(new URL(backend).origin, 'http://127.0.0.1:55200', 'Hosted payment test requires the isolated backend');
    assert.equal(f.priceHalalas, 30000);
    assert.ok(hosted?.id && hosted.phone, 'Reserved synthetic hosted client is required');
    assert.ok(hosted.email?.endsWith('@example.test'), 'Reserved synthetic hosted client must use the reserved domain');
    assert.ok(f.appointments.hosted, 'Hosted appointment is required');
    // The receipt survives a relay killed without cleanup, so it cannot prove liveness.
    // Probe the relay's local server before any booking or provider side effect.
    let relayProbe: number | null = null;
    try {
      const probed = await fetch(RELAY_PROBE_URL, { signal: AbortSignal.timeout(RELAY_PROBE_TIMEOUT_MS) });
      await probed.arrayBuffer();
      relayProbe = probed.status;
    } catch { relayProbe = null; /* refused or timed out */ }
    assert.equal(relayProbe, 404, 'Webhook relay is not running; restart e2e/local/webhook.mjs');
    const relay = webhookReceipt();
    assert.ok(typeof relay.registeredId === 'string' && relay.registeredId.length > 0 && relay.deleted === false,
      'Webhook relay must be running with its Sandbox registration (run e2e/local/webhook.mjs first)');
    const methods = await fetch(new URL('/api/v1/public/payments/methods', backend), { signal: AbortSignal.timeout(20_000) });
    assert.ok(methods.ok, `Payment methods endpoint failed with HTTP ${methods.status}`);
    const methodBody = await methods.json() as { moyasarEnabled?: boolean; data?: { moyasarEnabled?: boolean } };
    assert.ok((methodBody.data ?? methodBody).moyasarEnabled === true, 'Online payment must be enabled (run e2e/local/sandbox.mjs first)');
    const config = await withDb(prisma => prisma.organizationPaymentConfig.findFirst({ select: { isLive: true, publishableKey: true } }));
    assert.ok(config && config.isLive === false && config.publishableKey.startsWith('pk_test_'), 'Moyasar Sandbox (isLive=false, pk_test_) must be configured; live mode is forbidden');
    const before = readReceipt();
    const state = await readState();
    assert.ok(state.bookings.length <= 1, 'Hosted client must have at most one booking; refusing duplicate creation');
    if (!state.bookings.length) {
      assert.ok(!before.cardSubmitted, 'A card was submitted but no booking exists; inspect the Sandbox and start a fresh stack');
    }
    const baseline = before.webhookBaseline ?? (state.bookings.length ? 0 : relay.deliveries.length);
    saveReceipt({ createdAt: before.createdAt ?? new Date().toISOString(), webhookBaseline: baseline,
      cardSubmitted: before.cardSubmitted ?? false });

    // Next dev compiles routes lazily and Fast Refresh then reloads the page, dropping early
    // clicks. Warm the public routes with plain GETs (no session, no side effects) first.
    step = 'warm-routes';
    for (const route of ['/login', '/clinics', '/booking', '/booking/confirm', '/booking/payment-callback']) {
      const warmed = await fetch(new URL(route, websiteUrl), { signal: AbortSignal.timeout(90_000) });
      await warmed.arrayBuffer();
      assert.ok(warmed.status < 500, `Website route ${route} failed to compile (HTTP ${warmed.status})`);
    }

    // 2. Network allowlist for the whole browser: local stack and the exact Moyasar hosts only.
    step = 'network-allowlist';
    blocked = new Set<string>(before.blockedHosts ?? []);
    used = new Set<string>(before.usedHosts ?? []);
    await browser.route(/.*/, async route => {
      let host = '';
      try {
        const url = new URL(route.request.url);
        if (url.protocol === 'http:' || url.protocol === 'https:') host = url.host;
        if (host && permits(url)) { used.add(host); await route.continue(); return; }
      } catch { /* unparsable requests are blocked below */ }
      if (host) blocked.add(host);
      await route.abort();
    });
    networkReady = true;

    const password = credentials.user('client').password;
    const login = async () => {
      step = 'login';
      await app.open('/login');
      await screen.getByLabel('رقم الجوال').fill(hosted.phone);
      await screen.getByLabel('كلمة المرور').fill(password);
      await screen.getByRole('button', 'تسجيل الدخول').tap();
      await expect(browser).toHaveURL('/account');
    };
    const hostOf = async () => new URL(await browser.url()).host;

    // 3. Resume decision from persisted state; never submit a second card.
    let mode: 'fresh' | 'pay-existing' | 'await' | 'verify' = 'fresh';
    if (state.bookings.length === 1) {
      const status = state.bookings[0].status as string;
      if (status === 'CONFIRMED') mode = 'verify';
      else if (status === 'AWAITING_PAYMENT') mode = before.cardSubmitted ? 'await' : 'pay-existing';
      else assert.fail(`Existing hosted booking is in unsupported status ${status}; start a fresh stack`);
    }
    saveReceipt({ note: `mode=${mode}` });

    const waitConfirmed = async (deadline: number) => {
      step = 'await-webhook-settlement';
      for (;;) {
        const current = await readState();
        if (current.bookings[0]?.status === 'CONFIRMED') return;
        if (Date.now() >= deadline) {
          saveReceipt({ note: `not settled within ${SETTLE_TIMEOUT_MS / 1000}s of card submission; webhook deliveries=${webhookReceipt().deliveries.length - baseline}` });
          assert.fail('Payment was not settled by webhook within 90s; inspect the Sandbox payment, then start a fresh stack');
        }
        await sleep(1000);
      }
    };
    let cardAt = before.cardSubmittedAt ? Date.parse(before.cardSubmittedAt) : 0;

    if (mode === 'await') {
      // A card was already submitted by an earlier run of this stack: only wait.
      await waitConfirmed(Date.now() + SETTLE_TIMEOUT_MS);
    } else if (mode === 'verify') {
      await login();
    } else {
      await login();
      if (mode === 'fresh') {
        // 4. Same real wizard as SW-B03, with the hosted appointment and online payment.
        step = 'booking-wizard';
        await app.open('/clinics');
        await screen.getByRole('link', /عيادة اختبار الحجز/).tap();
        await expect(browser).toHaveURL(new RegExp(`categoryId=${f.clinicId}`));
        await screen.getByRole('radio', /جلسة اختبار أسرية/).tap();
        await expect(screen.getByRole('complementary', 'ملخص الموعد').getByText('ممارس الاختبار', { exact: true })).toBeVisible();
        await screen.getByRole('button', /^حضوري 60 دقيقة/).tap();
        const date = new Date(f.appointments.hosted);
        const dateLabel = new Intl.DateTimeFormat('ar-SA', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
        await screen.getByRole('radio', dateLabel, { exact: true }).tap();
        const slotLabel = date.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        await screen.getByRole('radio', slotLabel, { exact: true }).tap();
        await screen.getByRole('radio', /الدفع الإلكتروني/).tap();
        await screen.getByRole('button', 'تأكيد والدفع', { exact: true }).tap();
      } else {
        // The card was never submitted: the real "pay now" action re-initialises the same hosted invoice.
        step = 'pay-existing';
        await app.open(`/account/bookings/${state.bookings[0].id}`);
        await screen.getByRole('button', 'ادفع الآن', { exact: true }).tap();
      }

      // 5. The wizard hands off to the hosted checkout; nothing has been paid yet.
      step = 'redirect-to-checkout';
      try {
        await browser.waitForURL(/^https:\/\/[^/]+\.moyasar\.com\//, { timeout: 60_000 });
      } catch {
        persistNetwork();
        assert.fail(`Website did not reach the hosted checkout (page host ${await hostOf()}); blocked hosts are in the receipt`);
      }
      assert.ok(allowed.has(await hostOf()), 'Hosted checkout host is not on the explicit allowlist');
      step = 'pre-card-verification';
      const pending = await verifyBooking('hosted', 'AWAITING_PAYMENT');
      const attempt = await verifyHostedPayment({ bookingId: pending.bookingId, invoiceId: pending.invoices[0].id, status: 'PENDING' });
      assert.equal(attempt.amountHalalas, 30000);
      saveReceipt({ bookingId: pending.bookingId, invoiceId: attempt.invoiceId, paymentId: attempt.paymentId,
        bookingStatus: attempt.bookingStatus, invoiceStatus: attempt.invoiceStatus, paymentStatus: attempt.paymentStatus,
        amountHalalas: attempt.amountHalalas, currency: attempt.currency, cardSubmitted: false });

      // 6. Hosted checkout form. Frictionless official Sandbox test card only.
      step = 'card-form';
      const expiryYear = new Date().getUTCFullYear() + 2;
      await fillCardForm(expiryYear);
      step = 'card-submit';
      const pay = await payButton();
      cardAt = Date.now();
      saveReceipt({ cardSubmitted: true, cardSubmittedAt: new Date(cardAt).toISOString() });
      await pay.tap();

      // 7. Frictionless 3DS must return on its own; an interactive challenge is an explicit failure.
      step = '3ds-return';
      try {
        await browser.waitForURL(/\/booking\/payment-callback/, { timeout: 60_000 });
      } catch {
        persistNetwork();
        await dumpPageShape('hosted-diagnostic.json').catch(() => undefined);
        assert.fail(`Sandbox did not return to the website within 60s (page host ${await hostOf()}); an interactive 3DS challenge or a rejected card is not supported`);
      }
      step = 'confirm-link';
      await browser.locator('a[href^="/booking/confirm"]').first().tap();
      await expect(browser).toHaveURL(/\/booking\/confirm/);
      await waitConfirmed(cardAt + SETTLE_TIMEOUT_MS);
    }

    // 8. The webhook-driven confirmation shows on the real confirm page (it polls only ~30s, so reload once).
    step = 'confirm-page';
    const settled = await readState();
    assert.equal(settled.bookings[0]?.status, 'CONFIRMED');
    const settledAt = Date.now();
    const bookingId = settled.bookings[0].id as string;
    if (mode !== 'await' && mode !== 'verify') {
      const heading = screen.getByRole('heading', 'تم تأكيد موعدك!');
      if (!(await heading.isVisible())) {
        await sleep(3000);
        if (!(await heading.isVisible())) await browser.reload();
      }
      await expect(heading).toBeVisible({ timeout: 30_000 });
    }

    // 9. Final authoritative state: one completed payment, paid invoice, confirmed booking.
    step = 'final-verification';
    const confirmed = await verifyBooking('hosted');
    assert.equal(confirmed.bookingId, bookingId);
    assert.equal(confirmed.payAtClinic, false);
    assert.equal(confirmed.priceHalalas, 30000);
    assert.equal(confirmed.invoices.length, 1);
    assert.equal(confirmed.invoices[0].status, 'PAID');
    const payment = await verifyHostedPayment({ bookingId, invoiceId: confirmed.invoices[0].id, status: 'COMPLETED' });
    assert.equal(payment.amountHalalas, 30000);
    assert.equal(payment.currency, 'SAR');
    assert.equal(payment.invoiceStatus, 'PAID');
    assert.equal(payment.bookingStatus, 'CONFIRMED');

    step = 'webhook-delivery';
    const isPaid = (d: { eventType: string; httpStatus: number; skipped: boolean }) =>
      d.eventType === 'payment_paid' && d.httpStatus >= 200 && d.httpStatus < 300 && d.skipped === false;
    let deliveries = webhookReceipt().deliveries.slice(baseline);
    for (let i = 0; i < 20 && !deliveries.some(isPaid); i++) { await sleep(1000); deliveries = webhookReceipt().deliveries.slice(baseline); }
    const cardMs = cardAt || (before.cardSubmittedAt ? Date.parse(before.cardSubmittedAt) : 0);
    saveReceipt({ webhook: { deliveries: deliveries.length, paidDeliveries: deliveries.filter(isPaid).map(d => ({
      eventType: d.eventType, httpStatus: d.httpStatus, skipped: d.skipped,
      afterCardMs: cardMs ? Date.parse(d.receivedAt) - cardMs : null })) } });
    assert.ok(deliveries.some(isPaid), 'Settlement must arrive through a real payment_paid webhook delivery (2xx, not skipped)');

    // Webhook replays or the reconcile cron must not duplicate the payment.
    step = 'idempotency-recheck';
    await sleep(5000);
    const again = await verifyBooking('hosted');
    assert.deepEqual(again, confirmed, 'Booking, invoice and payment must be identical after the settlement window');
    const againPayment = await verifyHostedPayment({ bookingId, invoiceId: again.invoices[0].id, status: 'COMPLETED' });
    assert.deepEqual(againPayment, payment, 'Payment must not be duplicated or mutated');

    step = 'account-detail';
    await app.open(`/account/bookings/${bookingId}`);
    await expect(screen.getByText('جلسة اختبار أسرية', { exact: true })).toBeVisible();

    // 10. Receipt without keys, card data, provider ids or payment URLs.
    saveReceipt({ bookingId, invoiceId: payment.invoiceId, paymentId: payment.paymentId,
      bookingStatus: payment.bookingStatus, invoiceStatus: payment.invoiceStatus, paymentStatus: payment.paymentStatus,
      amountHalalas: payment.amountHalalas, currency: payment.currency, payAtClinic: confirmed.payAtClinic,
      // A verify-only rerun observes an old settlement; only runs that waited for it can time it.
      ...(mode === 'verify' ? {} : { settledAt: new Date(settledAt).toISOString(), ...(cardMs ? { settledAfterCardMs: settledAt - cardMs } : {}) }),
      outcome: 'passed', failedStep: undefined });
    persistNetwork();
  } catch (error) {
    // Only the step name is recorded; provider URLs and bodies never reach the receipt.
    saveReceipt({ outcome: 'failed', failedStep: step });
    if (networkReady) persistNetwork();
    throw error;
  }

  // Describes the current page by structure only: no page text, values, path, query or hash.
  async function dumpPageShape(name: string): Promise<void> {
    const shape = await browser.evaluate(() => {
      const frames: string[] = [];
      document.querySelectorAll('iframe').forEach(frame => {
        try { frames.push(new URL(frame.src, location.href).host); } catch { frames.push('?'); }
      });
      const count = (selector: string) => document.querySelectorAll(selector).length;
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a')).map(el => ({
        role: el.getAttribute('role') ?? el.tagName.toLowerCase(), label: (el.textContent ?? '').trim().slice(0, 60),
      }));
      return { host: location.host, frames, fields: { input: count('input'), select: count('select'), textarea: count('textarea') }, buttons };
    });
    writeFileSync(resolve(runDir, name), JSON.stringify(shape, null, 2), { mode: 0o600 });
  }
  // Official frictionless Sandbox card: https://docs.moyasar.com/guides/card-payments/test-cards
  async function fillCardForm(year: number): Promise<void> {
    const number = browser.locator('#mysr-cc-number');
    try {
      await number.waitFor({ state: 'visible', timeout: 30_000 });
    } catch {
      await dumpPageShape('hosted-diagnostic.json');
      assert.fail('Hosted checkout card form did not render; see hosted-diagnostic.json and blocked hosts in the receipt');
    }
    await browser.locator('#mysr-cc-name').fill('Test Client');
    await number.pressSequentially('4111114005765430');
    await browser.locator('#mysr-cc-exp').pressSequentially(`12${String(year).slice(-2)}`);
    await browser.locator('#mysr-cc-csc').pressSequentially('123');
    // Length checks only: card values are never read back into messages or receipts.
    assert.equal((await number.inputValue()).replace(/\D/g, '').length, 16, 'Card number was not accepted by the form');
    assert.equal((await browser.locator('#mysr-cc-exp').inputValue()).replace(/\D/g, '').length, 4, 'Expiry was not accepted by the form');
    assert.equal((await browser.locator('#mysr-cc-csc').inputValue()).length, 3, 'CVC was not accepted by the form');
  }
  // Resolve the pay button before the receipt claims a card was submitted.
  async function payButton() {
    const button = screen.getByRole('button', /^Pay\s+(SAR\s+)?300\.00/);
    await button.waitFor({ state: 'visible', timeout: 15_000 });
    return button;
  }
});
