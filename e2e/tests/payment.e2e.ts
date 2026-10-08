import assert from 'node:assert/strict';
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { NativePaymentInitResponse, NativePaymentReconcileResponse } from '../../packages/shared/types/native-payment.ts';
import { fixture, verifyBooking } from '../local/verify.mjs';
import { isTarget, websiteUrl } from '../urls.ts';

type Invoice = {
  id: string; bookingId: string; status: string; total: string | number;
  vatAmt: string | number; currency: string;
  payments: Array<{ id: string; status: string; amount: string | number; gatewayRef: string }>;
};

// Native API/provider contract acceptance. This does not exercise native UI,
// Apple Pay, or webhook delivery: reconcile fetches authoritative provider state.
test('SW-P01 native payment contract pays a booking through Moyasar Sandbox', {
  tags: ['payment', 'website'], requires: ['browser'],
}, async ({ app, browser }) => {
  const f = fixture(); // Reject any invocation outside the isolated local database.
  test.skip(!isTarget(app.baseUrl, websiteUrl), 'website only');
  const backend = new URL(process.env.BACKEND_URL!);
  assert.equal(backend.origin, 'http://127.0.0.1:55200', 'Payment test requires the isolated backend');
  assert.equal(new URL(websiteUrl).origin, 'http://127.0.0.1:55205', 'Payment test requires the isolated website');
  assert.equal(f.priceHalalas, 30000);
  const password = process.env.E2E_USER_CLIENT_PASSWORD;
  assert.ok(password, 'Synthetic client password is required');
  assert.ok(f.clients.payment?.email?.endsWith('@example.test'), 'Reserved synthetic payment client is required');

  // Mobile controllers return bare JSON, unlike the website client transport.
  // Never include response bodies or authentication material in failure messages.
  async function api<T>(path: string, token?: string, body?: unknown): Promise<T> {
    const response = await fetch(new URL(`/api/v1${path}`, backend), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    });
    assert.ok(response.ok, `Native API ${path} failed with HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }
  const session = await api<{ sessionKind: string; tokens: { accessToken: string } }>(
    '/mobile/auth/password-login', undefined, { email: f.clients.payment.email, password },
  );
  assert.equal(session.sessionKind, 'client');
  assert.ok(typeof session.tokens?.accessToken === 'string' && session.tokens.accessToken.length > 0, 'Password login must issue an access token');
  const token = session.tokens.accessToken;
  const capabilities = await api<{ enabled: boolean; isLive: boolean }>('/mobile/client/payments/native/config', token);
  assert.ok(capabilities.enabled === true && capabilities.isLive === false, 'Moyasar Sandbox must be configured even when resuming a completed fixture');

  // Calendar day +4 in Riyadh, at 09:00 (+03:00); never depend on host timezone.
  const scheduledAt = f.appointments.payment;
  type ExistingBooking = { id: string; clientId: string; serviceId: string; employeeId: string;
    status: string; payAtClinic: boolean; invoice: { id: string } | null };
  const existing = await api<{ items: ExistingBooking[]; meta: { total: number } }>('/mobile/client/bookings?limit=2', token);
  assert.ok(existing.meta.total <= 1 && existing.items.length === existing.meta.total, 'Reserved client must have at most one booking; refusing duplicate creation');
  const previous = existing.items[0];
  if (previous) {
    assert.equal(previous.clientId, f.clients.payment.id);
    assert.equal(previous.serviceId, f.serviceId);
    assert.equal(previous.employeeId, f.employeeId);
    assert.equal(previous.payAtClinic, false);
    assert.ok(previous.status === 'awaiting_payment' || previous.status === 'confirmed', 'Existing payment booking is no longer resumable');
    assert.ok(previous.invoice?.id, 'Existing payment booking must have its invoice');
  }
  const booking = previous ? { id: previous.id, invoiceId: previous.invoice!.id, status: previous.status.toUpperCase() } : await api<{ id: string; invoiceId: string; status: string }>(
    '/mobile/client/bookings', token, {
      branchId: f.branchId, employeeId: f.employeeId, serviceId: f.serviceId,
      durationOptionId: f.optionId, deliveryType: 'IN_PERSON', scheduledAt, payAtClinic: false,
    },
  );
  assert.ok(booking.status === 'AWAITING_PAYMENT' || (previous && booking.status === 'CONFIRMED'), 'Booking must begin awaiting payment or resume its completed fixture');
  assert.ok(booking.invoiceId, 'Online booking must create an invoice');
  const initial = await verifyBooking('payment', booking.status);
  assert.equal(initial.bookingId, booking.id);
  assert.equal(initial.invoices[0].id, booking.invoiceId);
  assert.equal(initial.invoices[0].status, booking.status === 'CONFIRMED' ? 'PAID' : 'DRAFT');

  // Recover an ambiguous previous browser POST before exposing another create.
  // A provider404 is the only native contract that authorizes provider creation.
  const before = await api<Invoice>(`/mobile/client/payments/invoices/${booking.invoiceId}`, token);
  assert.ok(before.payments.length <= 1, 'Refusing a fixture with multiple payment attempts');
  let completedPaymentId: string | undefined;
  let initiatedPaymentId: string | undefined;
  if (before.payments[0]) {
    const reserved = before.payments[0];
    assert.equal(reserved.gatewayRef, reserved.id, 'Existing attempt must be a native reservation');
    const recovered = await api<NativePaymentReconcileResponse>(`/mobile/client/payments/native/${reserved.id}/reconcile`, token, {});
    assert.equal(recovered.paymentId, reserved.id);
    assert.equal(recovered.invoiceId, booking.invoiceId);
    assert.equal(recovered.requiresReview, false);
    if (recovered.status === 'COMPLETED') completedPaymentId = reserved.id;
    else {
      assert.equal(recovered.status, 'PENDING', 'Existing provider attempt failed or closed; use a fresh isolated fixture');
      assert.equal(recovered.unavailableReason, undefined, 'Existing reservation is no longer payable');
      if (recovered.canCreatePayment !== true) initiatedPaymentId = reserved.id;
    }
  }

  let attempt: { paymentId: string; invoiceId: string };
  if (completedPaymentId) {
    attempt = { paymentId: completedPaymentId, invoiceId: booking.invoiceId };
  } else {

    let config: NativePaymentInitResponse['config'];
    if (initiatedPaymentId) {
      // native/config exposes no key and init rejects an existing provider
      // payment. Parent supplies only the public test key for this GET path.
      const resumeKey = process.env.E2E_MOYASAR_PUBLISHABLE_KEY;
      assert.ok(typeof resumeKey === 'string' && /^pk_test_[A-Za-z0-9]+$/.test(resumeKey), 'A test publishable key is required to read the existing provider payment');
      attempt = { paymentId: initiatedPaymentId, invoiceId: booking.invoiceId };
      config = { enabled: true, isLive: false, publishableKey: resumeKey,
        givenId: initiatedPaymentId, amount: 30000, currency: 'SAR',
        description: `Invoice payment - ${booking.invoiceId}`, supportedNetworks: ['visa'], applePay: null };
    } else {
      const initialized = await api<NativePaymentInitResponse>('/mobile/client/payments/native/init', token, {
        invoiceId: booking.invoiceId, method: 'ONLINE_CARD',
      });
      attempt = initialized;
      config = initialized.config;
      assert.equal(attempt.invoiceId, booking.invoiceId);
      assert.match(attempt.paymentId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.equal(config.givenId, attempt.paymentId);
      assert.equal(config.amount, 30000);
      assert.equal(config.currency, 'SAR');
      assert.equal(config.description, `Invoice payment - ${booking.invoiceId}`);
      // Boolean assertions prevent a bad key from being printed in a diff.
      assert.ok(config.enabled === true && config.isLive === false, 'Moyasar Sandbox must be enabled; live mode is forbidden');
      assert.ok(typeof config.publishableKey === 'string' && config.publishableKey.startsWith('pk_test_') && config.publishableKey.length > 8, 'A test publishable key must be configured');
      if (process.env.E2E_MOYASAR_PUBLISHABLE_KEY !== undefined) {
        assert.ok(config.publishableKey === process.env.E2E_MOYASAR_PUBLISHABLE_KEY, 'Injected publishable key must match authoritative native init configuration');
      }
      const preflight = await api<NativePaymentReconcileResponse>(`/mobile/client/payments/native/${attempt.paymentId}/reconcile`, token, {});
      assert.equal(preflight.paymentId, attempt.paymentId);
      assert.equal(preflight.invoiceId, booking.invoiceId);
      assert.equal(preflight.requiresReview, false);
      assert.equal(preflight.status, 'PENDING');
      assert.equal(preflight.canCreatePayment, true, 'Provider must confirm this reservation is absent before card submission');
    }

    // The native SDK has no merchant website CSP. Use the provider-origin
    // document as this native contract's transport harness; the website's hosted
    // checkout policy intentionally does not allow direct card API submission.
    await browser.goto('https://api.moyasar.com/');
    // Card data goes from the browser directly to Moyasar, never to our backend.
    // Mirrors createNativePaymentConfig + the installed SDK PaymentRequest:
    // given_id, apply_coupon=false, SDK callback, and no metadata (the app does
    // not set it). Invoice ownership is bound by the reserved ID/description.
    // Official frictionless card: https://docs.moyasar.com/guides/card-payments/test-cards
    const browserConfig = { enabled: config.enabled, isLive: config.isLive, publishableKey: config.publishableKey,
      givenId: config.givenId, amount: config.amount, currency: config.currency, description: config.description,
      resume: Boolean(initiatedPaymentId) };
    const provider = await browser.evaluate(async (config: typeof browserConfig) => {
      if (location.origin !== 'https://api.moyasar.com') throw new Error('Provider-origin browser transport is required');
      if (config.isLive || !config.enabled || !config.publishableKey.startsWith('pk_test_')) {
        throw new Error('Refusing non-Sandbox payment');
      }
      const response = await fetch(config.resume ? `https://api.moyasar.com/v1/payments/${config.givenId}` : 'https://api.moyasar.com/v1/payments', {
        method: config.resume ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`${config.publishableKey}:`)}` },
        ...(config.resume ? {} : { body: JSON.stringify({
          given_id: config.givenId, amount: config.amount, currency: config.currency,
          description: config.description, callback_url: 'https://sdk.moyasar.com/return', apply_coupon: false,
          source: { type: 'creditcard', company: 'visa', name: 'Test Client', number: '4111114005765430',
            month: '12', year: String(new Date().getUTCFullYear() + 2), cvc: '123', manual: 'false', save_card: 'false' },
        }) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Moyasar Sandbox request failed (HTTP ${response.status}); check test account/card configuration`);
      const payment = await response.json();
      if (payment.id !== config.givenId || payment.amount !== config.amount || payment.currency !== config.currency
        || payment.description !== config.description || !['initiated', 'paid'].includes(payment.status)) {
        throw new Error('Provider payment identity, amount, invoice description or state does not match the reserved Sandbox attempt');
      }
      // Return only necessary identifiers/state; no keys, card or full source.
      return { id: payment.id as string, status: payment.status as string, amount: payment.amount as number, currency: payment.currency as string,
        transactionUrl: typeof payment.source?.transaction_url === 'string' ? payment.source.transaction_url as string : null };
    }, browserConfig);
    assert.equal(provider.id, attempt.paymentId);
    assert.equal(provider.amount, 30000);
    assert.equal(provider.currency, 'SAR');
    if (provider.status === 'initiated') {
      assert.ok(provider.transactionUrl, 'Initiated Sandbox payment has no authentication URL');
      const url = new URL(provider.transactionUrl);
      assert.ok(url.origin === 'https://api.moyasar.com' && !url.username && !url.password && !url.hash
        && (/^\/v1\/card_auth\/[0-9a-f-]{36}\/prepare$/.test(url.pathname)
          || /^\/v1\/transaction_auths\/[0-9a-f-]{36}(?:\/form)?$/.test(url.pathname)), 'Unsupported Sandbox authentication URL');
      try {
        // The real native SDK intercepts its return URL before navigation.
        // This only stands in for that callback handler, never provider state.
        await browser.route(/^https:\/\/sdk\.moyasar\.com\/return(?:\?|$)/, async route => {
          await route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><title>SDK return</title>' });
        });
        // Frictionless authentication should redirect without entering a bank OTP.
        await browser.goto(url.href);
        await browser.waitForURL(/^https:\/\/sdk\.moyasar\.com\/return(?:\?|$)/, { timeout: 30_000 });
      } catch {
        throw new Error('Sandbox frictionless authentication did not return within 30s; interactive 3DS continuation is unsupported by SW-P01. Inspect the reserved payment before retrying.');
      }
    } else {
      assert.equal(provider.status, 'paid', 'Sandbox frictionless card must be paid or require authentication');
    }
  }

  async function reconcile() {
    const result = await api<NativePaymentReconcileResponse>(`/mobile/client/payments/native/${attempt.paymentId}/reconcile`, token, {});
    assert.equal(result.paymentId, attempt.paymentId);
    assert.equal(result.invoiceId, booking.invoiceId);
    assert.equal(result.status, 'COMPLETED', 'Backend must fetch a real paid Moyasar outcome');
    assert.equal(result.requiresReview, false);
  }
  async function readPaidInvoice() {
    const invoice = await api<Invoice>(`/mobile/client/payments/invoices/${booking.invoiceId}`, token);
    assert.equal(invoice.id, booking.invoiceId);
    assert.equal(invoice.bookingId, booking.id);
    assert.equal(invoice.status, 'PAID');
    assert.equal(Number(invoice.total), 30000);
    assert.equal(Number(invoice.vatAmt), 0);
    assert.equal(invoice.currency, 'SAR');
    assert.equal(invoice.payments.length, 1, 'Reconciliation must not duplicate payments');
    assert.equal(invoice.payments[0].id, attempt.paymentId);
    assert.equal(invoice.payments[0].gatewayRef, attempt.paymentId);
    assert.equal(invoice.payments[0].status, 'COMPLETED');
    assert.equal(Number(invoice.payments[0].amount), 30000);
  }
  await reconcile();
  await readPaidInvoice();
  // Booking confirmation is an asynchronous domain-event consumer.
  await expect.poll(() => verifyBooking('payment'), { timeout: 30_000 }).toMatchObject({ status: 'CONFIRMED' });
  const paid = await verifyBooking('payment');
  assert.equal(paid.bookingId, booking.id);
  await reconcile();
  await readPaidInvoice();
  const repeated = await verifyBooking('payment');
  assert.deepEqual(repeated, paid, 'Repeated reconciliation must preserve the sole paid invoice/booking');
  const readback = await api<{ id: string; status: string; payment: { id: string; status: string }; invoice: { id: string; status: string; outstanding: number } }>(`/mobile/client/bookings/${booking.id}`, token);
  assert.equal(readback.id, booking.id);
  assert.equal(readback.status, 'confirmed');
  assert.equal(readback.payment.id, attempt.paymentId);
  assert.equal(readback.payment.status, 'paid');
  assert.equal(readback.invoice.id, booking.invoiceId);
  assert.equal(readback.invoice.status, 'PAID');
  assert.equal(readback.invoice.outstanding, 0);
});
