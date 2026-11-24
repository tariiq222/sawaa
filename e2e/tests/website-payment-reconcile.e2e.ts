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
// The confirm page polls every 3s (10 attempts) and asks the backend to reconcile on polls 3 and 8.
const CONFIRM_WINDOW_MS = 35_000;
const DB_SETTLE_MS = 30_000;
// SW-P04 never starts e2e/local/webhook.mjs, which would bind this port.
const RELAY_PROBE_URL = 'http://127.0.0.1:55207/';
const RECONCILE_PATH = /^\/api\/v1\/client\/payments\/bookings\/[^/]+\/reconcile$|\/client\/payments\/bookings\/[^/]+\/reconcile$/;
const RECONCILE_URL = /\/client\/payments\/bookings\/[^/]+\/reconcile(?:\?|$)/;
const sleep = (ms: number) => new Promise<void>(ok => setTimeout(ok, ms));

type ReconcileReceipt = {
  createdAt?: string; cardSubmitted?: boolean; cardSubmittedAt?: string;
  bookingId?: string; invoiceId?: string; paymentId?: string;
  bookingStatus?: string; invoiceStatus?: string; paymentStatus?: string;
  amountHalalas?: number; currency?: string; payAtClinic?: boolean;
  confirmPageSuccessAfterCardMs?: number; settledAt?: string; settledAfterCardMs?: number;
  reconcilePosts?: number; reconcileStatuses?: number[]; settledBy?: 'reconcile';
  blockedHosts?: string[]; allowedHosts?: string[]; usedHosts?: string[];
  outcome?: 'passed' | 'failed'; failedStep?: string; note?: string;
};

test('SW-P04 website hosted card payment settles through the on-demand reconcile, without a webhook', {
  tags: ['payment-reconcile', 'website'], requires: ['browser'],
}, async ({ app, screen, browser }) => {
  test.skip(!isTarget(app.baseUrl, websiteUrl), 'website only');
  const f = fixture(); // Rejects any invocation outside the isolated local database.
  const runDir = process.env.E2E_LOCAL_RUN_DIR!;
  const backend = process.env.BACKEND_URL!;
  const receiptPath = resolve(runDir, 'reconcile-payment-receipt.json'); // reconcile-receipt.json is owned by verifyBooking
  const webhookPath = resolve(runDir, 'webhook-receipt.json');
  const client = f.clients.reconcile;
  let step = 'prechecks';
  const allowed = new Set([...LOCAL_HOSTS, ...MOYASAR_HOSTS]);
  let blocked = new Set<string>();
  let used = new Set<string>();
  let networkReady = false;
  let reconcilePosts = 0;
  const reconcileStatuses: number[] = [];
  let collecting = false;
  let collector: Promise<void> = Promise.resolve();
  const persistNetwork = () => saveReceipt({
    blockedHosts: [...blocked].filter(entry => {
      const sep = entry.indexOf('://');
      if (sep === -1) return !used.has(entry);
      const url = new URL(entry);
      return !(used.has(url.host) && permits(url));
    }).sort(),
    allowedHosts: [...allowed].sort(),
    usedHosts: [...used].sort(),
  });

  const readReceipt = (): ReconcileReceipt => (existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : {});
  const saveReceipt = (patch: ReconcileReceipt): ReconcileReceipt => {
    const merged = { ...readReceipt(), ...patch };
    writeFileSync(receiptPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
    return merged;
  };
  const withDb = async <T>(run: (prisma: any) => Promise<T>): Promise<T> => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    try { return await run(prisma); } finally { await prisma.$disconnect(); }
  };
  const readState = () => withDb(async prisma => {
    const bookings = await prisma.booking.findMany({ where: { clientId: client.id }, select: { id: true, status: true } });
    if (bookings.length !== 1) return { bookings, invoiceId: null as string | null, payments: 0 };
    const invoice = await prisma.invoice.findFirst({ where: { bookingId: bookings[0].id }, select: { id: true, payments: { select: { id: true } } } });
    return { bookings, invoiceId: (invoice?.id ?? null) as string | null, payments: (invoice?.payments.length ?? 0) as number };
  });

  try {
    // 1. No-side-effect prechecks: nothing below creates a booking or contacts the provider.
    assert.equal(new URL(websiteUrl).origin, 'http://127.0.0.1:55205', 'Reconcile payment test requires the isolated website');
    assert.equal(new URL(backend).origin, 'http://127.0.0.1:55200', 'Reconcile payment test requires the isolated backend');
    assert.equal(f.priceHalalas, 30000);
    assert.ok(client?.id && client.phone, 'Reserved synthetic reconcile client is required');
    assert.ok(client.email?.endsWith('@example.test'), 'Reserved synthetic reconcile client must use the reserved domain');
    assert.ok(f.appointments.reconcile, 'Reconcile appointment is required');
    // Only the on-demand reconcile may settle this payment: no relay, no webhook registration.
    let listener: number | null = null;
    try {
      const probed = await fetch(RELAY_PROBE_URL, { signal: AbortSignal.timeout(5_000) });
      await probed.arrayBuffer();
      listener = probed.status;
    } catch { listener = null; /* refused or timed out: nothing listens */ }
    assert.equal(listener, null, 'Something listens on 127.0.0.1:55207; stop the webhook relay, SW-P04 must run without it');
    assert.ok(!existsSync(webhookPath), 'webhook-receipt.json exists in this run; SW-P04 needs a stack without any webhook relay');
    const methods = await fetch(new URL('/api/v1/public/payments/methods', backend), { signal: AbortSignal.timeout(20_000) });
    assert.ok(methods.ok, `Payment methods endpoint failed with HTTP ${methods.status}`);
    const methodBody = await methods.json() as { moyasarEnabled?: boolean; data?: { moyasarEnabled?: boolean } };
    assert.ok((methodBody.data ?? methodBody).moyasarEnabled === true, 'Online payment must be enabled (run e2e/local/sandbox.mjs first)');
    const config = await withDb(prisma => prisma.organizationPaymentConfig.findFirst({ select: { isLive: true, publishableKey: true } }));
    assert.ok(config && config.isLive === false && config.publishableKey.startsWith('pk_test_'), 'Moyasar Sandbox (isLive=false, pk_test_) must be configured; live mode is forbidden');
    const before = readReceipt();
    const state = await readState();
    assert.ok(state.bookings.length <= 1, 'Reconcile client must have at most one booking; refusing duplicate creation');
    if (!state.bookings.length) {
      assert.ok(!before.cardSubmitted, 'A card was submitted but no booking exists; inspect the Sandbox and start a fresh stack');
    }
    saveReceipt({ createdAt: before.createdAt ?? new Date().toISOString(), cardSubmitted: before.cardSubmitted ?? false });

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
      let url: URL | null = null;
      try { url = new URL(route.request.url); } catch { /* unparsable requests are blocked below */ }
      const host = url && (url.protocol === 'http:' || url.protocol === 'https:') ? url.host : '';
      if (url && host && permits(url)) {
        used.add(host);
        // Counted by method and path shape only; no body, id or query is kept.
        if (route.request.method === 'POST' && RECONCILE_PATH.test(url.pathname)) reconcilePosts++;
        await route.continue();
        return;
      }
      if (url && host) blocked.add(`${url.protocol}//${host}`);
      await route.abort();
    });
    networkReady = true;

    const password = credentials.user('client').password;
    const login = async () => {
      step = 'login';
      await app.open('/login');
      await screen.getByLabel('رقم الجوال').fill(client.phone);
      await screen.getByLabel('كلمة المرور').fill(password);
      await screen.getByRole('button', 'تسجيل الدخول').tap();
      await expect(browser).toHaveURL('/account');
    };
    const hostOf = async () => new URL(await browser.url()).host;
    // Status codes of reconcile responses seen by the browser (status only, never the body).
    const startCollector = () => {
      collecting = true;
      collector = (async () => {
        while (collecting) {
          try {
            const response = await browser.waitForResponse(RECONCILE_URL, { timeout: 4_000 });
            reconcileStatuses.push(response.status);
          } catch { /* no response in this slice */ }
        }
      })();
    };
    const stopCollector = async () => { collecting = false; await collector; };

    // 3. Resume decision from persisted state; never submit a second card.
    let mode: 'fresh' | 'pay-existing' | 'await' | 'verify' = 'fresh';
    if (state.bookings.length === 1) {
      const status = state.bookings[0].status as string;
      if (status === 'CONFIRMED') mode = 'verify';
      else if (status === 'AWAITING_PAYMENT') mode = before.cardSubmitted ? 'await' : 'pay-existing';
      else assert.fail(`Existing reconcile booking is in unsupported status ${status}; start a fresh stack`);
    }
    saveReceipt({ note: `mode=${mode}` });

    let cardAt = before.cardSubmittedAt ? Date.parse(before.cardSubmittedAt) : 0;
    const waitConfirmPageSuccess = async () => {
      // The page must reach its success state on its own: no reload, no manual retry.
      step = 'confirm-page-reconcile';
      const heading = screen.getByRole('heading', 'تم تأكيد موعدك!');
      const deadline = Date.now() + CONFIRM_WINDOW_MS;
      while (!(await heading.isVisible())) {
        if (Date.now() >= deadline) {
          await stopCollector();
          saveReceipt({ reconcilePosts, reconcileStatuses,
            note: `confirm page still not confirmed ${CONFIRM_WINDOW_MS / 1000}s after load; reconcile POSTs=${reconcilePosts}, statuses=${reconcileStatuses.join(',') || 'none'}` });
          assert.fail(`Confirm page did not reach its success state within ${CONFIRM_WINDOW_MS / 1000}s; reconcile POSTs=${reconcilePosts}`);
        }
        await sleep(1000);
      }
      const at = Date.now();
      await stopCollector();
      saveReceipt({ reconcilePosts, reconcileStatuses, ...(cardAt ? { confirmPageSuccessAfterCardMs: at - cardAt } : {}) });
      assert.ok(reconcilePosts >= 1, 'The confirm page never called the reconcile endpoint');
      assert.ok(reconcileStatuses.includes(200), `No reconcile POST returned 200 (statuses: ${reconcileStatuses.join(',') || 'none'})`);
      return at;
    };
    const waitConfirmedInDb = async () => {
      step = 'await-db-settlement';
      const deadline = Date.now() + DB_SETTLE_MS;
      for (;;) {
        const current = await readState();
        if (current.bookings[0]?.status === 'CONFIRMED') return;
        if (Date.now() >= deadline) {
          saveReceipt({ note: `booking not CONFIRMED within ${DB_SETTLE_MS / 1000}s after the confirm page succeeded` });
          assert.fail('Booking was not CONFIRMED in the database after the confirm page succeeded');
        }
        await sleep(1000);
      }
    };

    let successAt = 0;
    if (mode === 'await') {
      // A card was already submitted by an earlier run of this stack: only watch the confirm page.
      await login();
      step = 'confirm-open';
      startCollector();
      await app.open(`/booking/confirm?bookingId=${state.bookings[0].id}`);
      successAt = await waitConfirmPageSuccess();
      await waitConfirmedInDb();
    } else if (mode === 'verify') {
      await login();
    } else {
      await login();
      if (mode === 'fresh') {
        // 4. Same real wizard as SW-P03, with the reconcile appointment and online payment.
        step = 'booking-wizard';
        await app.open('/clinics');
        await screen.getByRole('link', /عيادة اختبار الحجز/).tap();
        await expect(browser).toHaveURL(new RegExp(`categoryId=${f.clinicId}`));
        await screen.getByRole('radio', /جلسة اختبار أسرية/).tap();
        await expect(screen.getByRole('complementary', 'ملخص الموعد').getByText('ممارس الاختبار', { exact: true })).toBeVisible();
        await screen.getByRole('button', /^حضوري 60 دقيقة/).tap();
        const date = new Date(f.appointments.reconcile);
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
      const pending = await verifyBooking('reconcile', 'AWAITING_PAYMENT');
      const attempt = await verifyHostedPayment({ bookingId: pending.bookingId, invoiceId: pending.invoices[0].id, status: 'PENDING', kind: 'reconcile' });
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
        await dumpPageShape('reconcile-diagnostic.json').catch(() => undefined);
        assert.fail(`Sandbox did not return to the website within 60s (page host ${await hostOf()}); an interactive 3DS challenge or a rejected card is not supported`);
      }
      step = 'confirm-link';
      startCollector();
      await browser.locator('a[href^="/booking/confirm"]').first().tap();
      await expect(browser).toHaveURL(/\/booking\/confirm/);
      // 8. No webhook exists: the confirm page itself must flip to success through its reconcile calls.
      successAt = await waitConfirmPageSuccess();
      await waitConfirmedInDb();
    }

    // 9. Final authoritative state: one completed payment, paid invoice, confirmed booking.
    step = 'final-verification';
    const settled = await readState();
    assert.equal(settled.bookings[0]?.status, 'CONFIRMED');
    const bookingId = settled.bookings[0].id as string;
    const confirmed = await verifyBooking('reconcile');
    assert.equal(confirmed.bookingId, bookingId);
    assert.equal(confirmed.payAtClinic, false);
    assert.equal(confirmed.priceHalalas, 30000);
    assert.equal(confirmed.invoices.length, 1);
    assert.equal(confirmed.invoices[0].status, 'PAID');
    const payment = await verifyHostedPayment({ bookingId, invoiceId: confirmed.invoices[0].id, status: 'COMPLETED', kind: 'reconcile' });
    assert.equal(payment.amountHalalas, 30000);
    assert.equal(payment.currency, 'SAR');
    assert.equal(payment.invoiceStatus, 'PAID');
    assert.equal(payment.bookingStatus, 'CONFIRMED');

    // Still no webhook anywhere: settlement can only come from the reconcile.
    step = 'no-webhook-recheck';
    assert.ok(!existsSync(webhookPath), 'A webhook relay appeared during SW-P04; the settlement proof is void');

    // Later polls, replays or the reconcile cron must not duplicate the payment.
    step = 'idempotency-recheck';
    await sleep(5000);
    const again = await verifyBooking('reconcile');
    assert.deepEqual(again, confirmed, 'Booking, invoice and payment must be identical after the settlement window');
    const againPayment = await verifyHostedPayment({ bookingId, invoiceId: again.invoices[0].id, status: 'COMPLETED', kind: 'reconcile' });
    assert.deepEqual(againPayment, payment, 'Payment must not be duplicated or mutated');

    step = 'account-detail';
    await app.open(`/account/bookings/${bookingId}`);
    await expect(screen.getByText('جلسة اختبار أسرية', { exact: true })).toBeVisible();

    // 10. Receipt without keys, card data, provider ids or payment URLs.
    const latest = readReceipt();
    const cardMs = cardAt || (before.cardSubmittedAt ? Date.parse(before.cardSubmittedAt) : 0);
    const reconciled = (latest.reconcileStatuses ?? []).includes(200);
    saveReceipt({ bookingId, invoiceId: payment.invoiceId, paymentId: payment.paymentId,
      bookingStatus: payment.bookingStatus, invoiceStatus: payment.invoiceStatus, paymentStatus: payment.paymentStatus,
      amountHalalas: payment.amountHalalas, currency: payment.currency, payAtClinic: confirmed.payAtClinic,
      // A verify-only rerun observes an old settlement; only runs that waited for it can time it.
      ...(mode === 'verify' || !successAt ? {} : { settledAt: new Date(successAt).toISOString(), ...(cardMs ? { settledAfterCardMs: successAt - cardMs } : {}) }),
      ...(reconciled && !existsSync(webhookPath) ? { settledBy: 'reconcile' as const } : {}),
      outcome: 'passed', failedStep: undefined });
    persistNetwork();
  } catch (error) {
    // Only the step name is recorded; provider URLs and bodies never reach the receipt.
    collecting = false;
    saveReceipt({ outcome: 'failed', failedStep: step, ...(reconcilePosts ? { reconcilePosts, reconcileStatuses } : {}) });
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
      // Buttons keep their label; anchor text can carry a provider reference, so anchors keep only their role.
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a')).map(el => ({
        role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
        label: el.tagName === 'A' ? '' : (el.textContent ?? '').trim().slice(0, 60),
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
      await dumpPageShape('reconcile-diagnostic.json');
      assert.fail('Hosted checkout card form did not render; see reconcile-diagnostic.json and blocked hosts in the receipt');
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
