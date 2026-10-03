import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/infrastructure/database';
import { createRealE2eApp, request } from '../../helpers/create-real-e2e-app';
import { CancellationRefundIntentService } from '../../../src/modules/finance/cancellation-refund/cancellation-refund-intent.service';
import type { ClientCancellationIntent } from '../../../src/modules/bookings/client/client-cancellation-policy';
import { DenyRefundHandler } from '../../../src/modules/finance/refund-payment/deny-refund.handler';
import { OnRefundOutcomeHandler } from '../../../src/modules/comms/events/on-refund-outcome.handler';
import type { DomainEventEnvelope } from '../../../src/infrastructure/events';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

// HTTP/auth + real disposable PostgreSQL. Provider delivery is mocked by the
// shared E2E setup; persisted cancellation and durable intent are real.
describeReal('Client cancellation policy (real HTTP and DB)', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let clientId: string;
  let token: string;
  let otherToken: string;
  let sequence = Math.floor(Math.random() * 100_000_000) + 600_000_000;

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    const clients = await Promise.all(['owner', 'other'].map(label => prisma.client.create({
      data: {
        name: `Cancellation test ${label}`, phone: `test-${randomUUID()}`,
        source: 'ONLINE', isActive: true, tokenVersion: 0,
      },
    })));
    clientId = clients[0].id;
    const sign = (id: string) => app.get(JwtService).sign({
      sub: id, namespace: 'client', jti: randomUUID(), tokenVersion: 0,
    }, { secret: process.env.JWT_CLIENT_ACCESS_SECRET! });
    token = sign(clientId);
    otherToken = sign(clients[1].id);
  });
  afterAll(async () => { if (app) await app.close(); });

  async function fixture(options: { paid?: boolean; late?: boolean; enabled?: boolean } = {}) {
    const branchId = randomUUID();
    const settings = await prisma.bookingSettings.create({ data: {
      branchId, clientCancellationPolicyEnabled: options.enabled !== false,
      clientCancelCutoffMode: 'BEFORE_START', clientCancelBeforeHours: 0,
      freeCancelBeforeHours: 24, freeCancelRefundType: 'FULL',
      lateCancelRefundPercent: 0, autoRefundOnCancel: false, requireCancelApproval: true,
    } });
    const scheduledAt = new Date(Date.now() + (options.late ? 2 : 48) * 3_600_000);
    const booking = await prisma.booking.create({ data: {
      clientId, branchId, employeeId: randomUUID(), serviceId: randomUUID(),
      bookingNumber: sequence++, bookingType: 'INDIVIDUAL',
      status: options.paid ? 'DEPOSIT_PAID' : 'CONFIRMED', source: 'RECEPTION',
      deliveryType: 'IN_PERSON', durationMins: 60, scheduledAt,
      endsAt: new Date(scheduledAt.getTime() + 3_600_000), price: 30_000, currency: 'SAR',
    } });
    const invoice = await prisma.invoice.create({ data: {
      bookingId: booking.id, branchId, clientId, employeeId: booking.employeeId,
      subtotal: 30_000, total: 30_000, vatAmt: 0, vatRate: 0, currency: 'SAR',
      status: options.paid ? 'PARTIALLY_PAID' : 'ISSUED',
      ...(options.paid ? { payments: { create: { amount: 10_000, status: 'COMPLETED', method: 'CASH' } } } : {}),
    }, include: { payments: true } });
    return { booking, invoice, settings };
  }

  const url = (id: string, audience = 'public/me') => `/api/v1/${audience}/bookings/${id}`;
  const preview = (id: string, audience?: string, bearer = token) =>
    request(app.getHttpServer()).get(`${url(id, audience)}/cancellation-preview`)
      .set('Authorization', `Bearer ${bearer}`);
  const cancel = (id: string, quoteToken: string, sourceActionId = randomUUID(), audience?: string) =>
    request(app.getHttpServer()).patch(`${url(id, audience)}/cancel`)
      .set('Authorization', `Bearer ${token}`).send({
        quoteToken, sourceActionId,
        ...(audience === 'mobile/client' ? { reason: 'CLIENT_REQUESTED' } : {}),
      });

  it.each(['public/me', 'mobile/client'])('%s enforces authentication and ownership for preview', async audience => {
    const { booking } = await fixture();
    await request(app.getHttpServer()).get(`${url(booking.id, audience)}/cancellation-preview`).expect(401);
    // Preview hides the existence of another client's resource.
    await preview(booking.id, audience, otherToken).expect(404);
    const result = await preview(booking.id, audience).expect(200);
    expect(result.body).toMatchObject({ policyEnabled: true, canCancel: true, reasonCode: 'ALLOWED' });
    expect(result.body.refund.status).toBe('NOT_APPLICABLE');
  });

  it.each(['public/me', 'mobile/client'])('%s cancels immediately, preserves cash, and records one durable refund intent', async audience => {
    const { booking, invoice } = await fixture({ paid: true });
    const quote = (await preview(booking.id, audience).expect(200)).body;
    expect(quote.refund).toMatchObject({ paidAmount: 10_000, refundAmount: 10_000, execution: 'REVIEW', status: 'PENDING_REVIEW' });
    const sourceActionId = randomUUID();
    const result = await cancel(booking.id, quote.quoteToken, sourceActionId, audience).expect(200);
    expect(result.body).toMatchObject({ status: 'CANCELLED', requiresApproval: false, refund: { status: 'PENDING_REVIEW', refundAmount: 10_000 } });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CANCELLED');
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } })).toEqual(invoice);
    expect(await prisma.refundRequest.count({ where: { invoiceId: invoice.id } })).toBe(0);
    const allEvents = await prisma.outboxEvent.findMany({ where: { aggregateId: booking.id } });
    expect(allEvents).toHaveLength(1);
    expect(JSON.stringify(allEvents[0].payload)).toContain('clientCancellation');
    await cancel(booking.id, quote.quoteToken, sourceActionId, audience).expect(200);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: booking.id } })).toBe(1);
    expect(await prisma.bookingStatusLog.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it('rejects an obsolete financial quote without cancelling; the refreshed quote requires another request', async () => {
    const { booking, settings } = await fixture({ paid: true });
    const quote = (await preview(booking.id).expect(200)).body;
    await prisma.bookingSettings.update({ where: { id: settings.id }, data: { freeCancelRefundType: 'PARTIAL', earlyCancelRefundPercent: 50 } });
    await cancel(booking.id, quote.quoteToken).expect(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('DEPOSIT_PAID');
    expect(await prisma.outboxEvent.count({ where: { aggregateId: booking.id } })).toBe(0);
    const refreshed = (await preview(booking.id).expect(200)).body;
    expect(refreshed.refund.refundAmount).toBe(5_000);
    await cancel(booking.id, refreshed.quoteToken).expect(200);
  });

  it.each(['PENDING_REVIEW', 'COMPLETED'] as const)('caps follow-up against a competing %s claim on a different capture', async status => {
    const { booking, invoice, settings } = await fixture({ paid: true });
    await prisma.payment.create({ data: { invoiceId: invoice.id, amount: 10_000, status: 'COMPLETED', method: 'CASH' } });
    await prisma.bookingSettings.update({ where: { id: settings.id }, data: { freeCancelRefundType: 'PARTIAL', earlyCancelRefundPercent: 50 } });
    const quote = (await preview(booking.id).expect(200)).body;
    expect(quote.refund.refundAmount).toBe(10_000);
    await cancel(booking.id, quote.quoteToken).expect(200);
    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: booking.id, eventType: 'bookings.booking.cancelled' } });
    const intent = (event.payload as unknown as { payload: { clientCancellation: ClientCancellationIntent } }).payload.clientCancellation;
    expect(intent.allocations).toHaveLength(1);
    const other = await prisma.payment.findFirstOrThrow({ where: { invoiceId: invoice.id, id: { not: intent.allocations[0].paymentId } } });
    await prisma.$transaction(async tx => {
      await tx.refundRequest.create({ data: { invoiceId: invoice.id, paymentId: other.id, clientId, amount: 10_000, status } });
      if (status === 'COMPLETED') await tx.payment.update({ where: { id: other.id }, data: { refundedAmount: 10_000, status: 'REFUNDED' } });
    });
    const followup = app.get(CancellationRefundIntentService);
    await followup.execute(event.id, booking.id, clientId, intent);
    await followup.execute(event.id, booking.id, clientId, intent);
    expect(await prisma.refundRequest.count({ where: { invoiceId: invoice.id } })).toBe(1);
    expect(await prisma.refundRequest.count({ where: { paymentId: intent.allocations[0].paymentId } })).toBe(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CANCELLED');
  });

  it('persists one partial follow-up request across replay after a competing claim', async () => {
    const { booking, invoice, settings } = await fixture({ paid: true });
    await prisma.payment.create({ data: { invoiceId: invoice.id, amount: 10_000, status: 'COMPLETED', method: 'CASH' } });
    await prisma.bookingSettings.update({ where: { id: settings.id }, data: { freeCancelRefundType: 'PARTIAL', earlyCancelRefundPercent: 50 } });
    const quote = (await preview(booking.id).expect(200)).body;
    await cancel(booking.id, quote.quoteToken).expect(200);
    const event = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: booking.id, eventType: 'bookings.booking.cancelled' } });
    const intent = (event.payload as unknown as { payload: { clientCancellation: ClientCancellationIntent } }).payload.clientCancellation;
    const other = await prisma.payment.findFirstOrThrow({ where: { invoiceId: invoice.id, id: { not: intent.allocations[0].paymentId } } });
    await prisma.refundRequest.create({ data: { invoiceId: invoice.id, paymentId: other.id, clientId, amount: 4_000, status: 'PENDING_REVIEW' } });
    const followup = app.get(CancellationRefundIntentService);
    await followup.execute(event.id, booking.id, clientId, intent);
    await followup.execute(event.id, booking.id, clientId, intent);
    const requests = await prisma.refundRequest.findMany({ where: { invoiceId: invoice.id } });
    expect(requests).toHaveLength(2);
    expect(requests.reduce((total, r) => total + Number(r.amount), 0)).toBe(10_000);
    expect(requests.find(r => r.paymentId === intent.allocations[0].paymentId)?.amount.toNumber()).toBe(6_000);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: booking.id, eventType: 'finance.cancellation-refund.updated' } })).toBe(1);
  });

  it('late cancellation can release the appointment with no refund despite legacy approval setting', async () => {
    const { booking, invoice } = await fixture({ paid: true, late: true });
    const quote = (await preview(booking.id).expect(200)).body;
    expect(quote).toMatchObject({ canCancel: true, refund: { status: 'NO_REFUND', refundAmount: 0, window: 'LATE' } });
    await cancel(booking.id, quote.quoteToken).expect(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CANCELLED');
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } })).toEqual(invoice);
  });

  it('persists later denial and one truthful client notification across outcome replay', async () => {
    const { booking, invoice } = await fixture({ paid: true });
    const quote = (await preview(booking.id).expect(200)).body;
    await cancel(booking.id, quote.quoteToken).expect(200);
    const cancellation = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: booking.id, eventType: 'bookings.booking.cancelled' } });
    const intent = (cancellation.payload as unknown as { payload: { clientCancellation: ClientCancellationIntent } }).payload.clientCancellation;
    await app.get(CancellationRefundIntentService).execute(cancellation.id, booking.id, clientId, intent);
    const refund = await prisma.refundRequest.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    await app.get(DenyRefundHandler).execute({ refundRequestId: refund.id, deniedBy: randomUUID(), reason: 'Synthetic reviewed denial' });
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: booking.id, eventType: 'finance.cancellation-refund.updated' } });
    const denied = events.find(e => (e.payload as unknown as { payload: { status: string } }).payload.status === 'DENIED');
    expect(denied).toBeDefined();
    const envelope = denied!.payload as unknown as DomainEventEnvelope<{ refundRequestId: string }>;
    const notifications = app.get(OnRefundOutcomeHandler);
    await notifications.handle(envelope, false);
    await notifications.handle(envelope, false);
    const delivered = await prisma.notification.findMany({ where: { recipientId: clientId, metadata: { path: ['refundRequestId'], equals: refund.id } } });
    expect(delivered).toHaveLength(1);
    expect(delivered[0].metadata).toMatchObject({ refundStatus: 'DENIED' });
    expect(delivered[0].body).not.toContain('بنجاح');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CANCELLED');
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } })).toEqual(invoice);
  });

  it.each([
    ['ATTENDED', { checkedInAt: new Date() }],
    ['HISTORICAL', { isHistoricalImport: true }],
    ['FINAL_STATE', { status: BookingStatus.COMPLETED }],
  ] as const)('blocks %s and preserves the booking', async (reasonCode, data) => {
    const { booking } = await fixture();
    const before = await prisma.booking.update({ where: { id: booking.id }, data });
    const quote = (await preview(booking.id).expect(200)).body;
    expect(quote).toMatchObject({ canCancel: false, reasonCode });
    const rejected = await cancel(booking.id, quote.quoteToken);
    // Keep auth/transport failures distinct from the expected policy denial.
    if (![400, 403, 409].includes(rejected.status)) {
      throw new Error(`Unexpected ${reasonCode} cancellation response: ${JSON.stringify({
        status: rejected.status,
        error: rejected.body.error,
        message: rejected.body.message,
        reasonCode: rejected.body.reasonCode,
      })}`);
    }
    expect([400, 403, 409]).toContain(rejected.status);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toEqual(before);
  });

  it('BEFORE_CHECK_IN permits a started appointment only before attendance and before its end', async () => {
    const { booking, settings } = await fixture();
    await prisma.bookingSettings.update({ where: { id: settings.id }, data: { clientCancelCutoffMode: 'BEFORE_CHECK_IN' } });
    await prisma.booking.update({ where: { id: booking.id }, data: {
      scheduledAt: new Date(Date.now() - 600_000), endsAt: new Date(Date.now() + 600_000),
    } });
    expect((await preview(booking.id).expect(200)).body.canCancel).toBe(true);
    await prisma.booking.update({ where: { id: booking.id }, data: { endsAt: new Date(Date.now() - 1_000) } });
    const quote = (await preview(booking.id).expect(200)).body;
    expect(quote).toMatchObject({ canCancel: false, reasonCode: 'CUTOFF_PASSED' });
    await cancel(booking.id, quote.quoteToken).expect(400);
  });

  it('disabled policy preserves the existing approval path', async () => {
    const { booking } = await fixture({ enabled: false });
    expect((await preview(booking.id).expect(200)).body.policyEnabled).toBe(false);
    const result = await request(app.getHttpServer()).patch(`${url(booking.id)}/cancel`)
      .set('Authorization', `Bearer ${token}`).send({ reason: 'Synthetic legacy path' }).expect(200);
    expect(result.body).toMatchObject({ status: 'CANCEL_REQUESTED', requiresApproval: true });
  });
});
