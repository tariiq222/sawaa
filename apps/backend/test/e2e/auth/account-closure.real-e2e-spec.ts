/** Real Postgres account closure coverage; runs only with a disposable test DB. */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { ClientTokenService } from '../../../src/modules/identity/shared/client-token.service';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('Client account closure — real Postgres e2e', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let clientTokens: ClientTokenService;
  let clientId: string;
  let userId: string;
  let bookingId: string;
  let invoiceId: string;
  let paymentId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureHttpContract(app, 'production');
    await app.init();
    prisma = app.get(PrismaService);
    clientTokens = app.get(ClientTokenService);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (prisma && paymentId) await prisma.payment.deleteMany({ where: { id: paymentId } });
    if (prisma && invoiceId) await prisma.invoice.deleteMany({ where: { id: invoiceId } });
    if (prisma && bookingId) await prisma.booking.deleteMany({ where: { id: bookingId } });
    if (prisma && clientId) {
      await prisma.fcmToken.deleteMany({ where: { clientId } });
      await prisma.clientRefreshToken.deleteMany({ where: { clientId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
    }
    if (prisma && userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (app) await app.close();
  });

  it('closes two device sessions and preserves linked booking, invoice and payment', async () => {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        name: 'Account closure fixture', role: 'CLIENT', isActive: true,
        email: `closure-${suffix}@sawaa.test`, phone: `+9665${Math.floor(10000000 + Math.random() * 89999999)}`,
      },
    });
    userId = user.id;
    const client = await prisma.client.create({
      data: {
        name: 'Account closure fixture', userId, isActive: true,
        email: user.email, phone: user.phone, accountType: 'FULL',
        notes: 'Synthetic clinical note retained by closure',
      },
    });
    clientId = client.id;
    const scheduledAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const booking = await prisma.booking.create({
      data: {
        branchId: randomUUID(), clientId, employeeId: randomUUID(),
        deliveryType: 'IN_PERSON', status: 'COMPLETED', completedAt: new Date(),
        scheduledAt, endsAt: new Date(scheduledAt.getTime() + 60 * 60 * 1000),
        durationMins: 60, price: 10000,
        notes: 'Synthetic counseling encounter retained by closure',
        bookingNumber: Math.floor(100000000 + Math.random() * 899999999),
      },
    });
    bookingId = booking.id;
    const invoice = await prisma.invoice.create({
      data: {
        branchId: booking.branchId, clientId, employeeId: booking.employeeId,
        bookingId, subtotal: 10000, vatRate: 0, vatAmt: 0, total: 10000,
        status: 'PAID', issuedAt: new Date(), paidAt: new Date(),
      },
    });
    invoiceId = invoice.id;
    const payment = await prisma.payment.create({
      data: { invoiceId, amount: 10000, method: 'CASH', status: 'COMPLETED', processedAt: new Date() },
    });
    paymentId = payment.id;
    const clinicalBefore = await prisma.booking.findUnique({ where: { id: bookingId } });
    const invoiceBefore = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    const paymentBefore = await prisma.payment.findUnique({ where: { id: paymentId } });

    const firstDevice = await clientTokens.issueTokenPair(client);
    const secondDevice = await clientTokens.issueTokenPair(client);
    await prisma.fcmToken.createMany({ data: [
      { clientId, token: `closure-${suffix}-device-a`, platform: 'android' },
      { clientId, token: `closure-${suffix}-device-b`, platform: 'android' },
    ] });
    await prisma.refreshToken.create({
      data: { userId, tokenHash: `synthetic-${suffix}`, tokenSelector: suffix.slice(0, 8), expiresAt: new Date(Date.now() + 60_000) },
    });

    const closed = await request(app.getHttpServer())
      .delete('/api/v1/mobile/client/profile')
      .set('Authorization', `Bearer ${firstDevice.accessToken}`)
      .expect(200);
    expect(closed.body).toEqual({ status: 'closed', retained: ['clinical_records', 'financial_records'] });
    await request(app.getHttpServer())
      .get('/api/v1/mobile/client/profile')
      .set('Authorization', `Bearer ${firstDevice.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/mobile/auth/refresh')
      .send({ refreshToken: firstDevice.rawRefresh })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/mobile/auth/refresh')
      .send({ refreshToken: secondDevice.rawRefresh })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/mobile/client/notifications/fcm-token')
      .set('Authorization', `Bearer ${secondDevice.accessToken}`)
      .send({ token: `closure-${suffix}-late`, platform: 'android' })
      .expect(401);

    const retained = await prisma.client.findUnique({ where: { id: clientId } });
    const linkedUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(retained).toMatchObject({
      notes: 'Synthetic clinical note retained by closure',
      isActive: false, phone: null, email: null, pushEnabled: false,
    });
    expect(retained?.deletedAt).not.toBeNull();
    expect(linkedUser).toMatchObject({ isActive: false, phone: null, passwordHash: null });
    expect(await prisma.booking.findUnique({ where: { id: bookingId } })).toEqual(clinicalBefore);
    expect(await prisma.invoice.findUnique({ where: { id: invoiceId } })).toEqual(invoiceBefore);
    expect(await prisma.payment.findUnique({ where: { id: paymentId } })).toEqual(paymentBefore);
    expect(await prisma.clientRefreshToken.count({ where: { clientId, revokedAt: null } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);
    expect(await prisma.fcmToken.count({ where: { clientId } })).toBe(0);
  });
});
