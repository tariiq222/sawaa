/**
 * Real client-session coverage for package balances and credit booking.
 *
 * This spec uses only a guarded REAL_E2E_DATABASE_URL. It verifies that both
 * the website public/me aliases and the mobile aliases bind reads and writes
 * to the client JWT, including pending and already-reserved credit guards.
 */
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('client package access and booking (real DB)', () => {
  jest.setTimeout(60_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let jwt: JwtService;
  let ownerId: string;
  let otherClientId: string;
  let ownerPendingPurchaseId: string;
  let ownerReservedCreditId: string;
  let ownerPendingCreditId: string;
  let otherPurchaseId: string;
  let otherCreditId: string;

  const branchId = randomUUID();
  const packageId = randomUUID();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    jwt = app.get(JwtService);

    const [owner, other] = await Promise.all([
      prisma.client.create({ data: { name: `package-access-owner-${suffix}`, email: `package-access-owner-${suffix}@sawaa.test`, accountType: 'FULL', claimedAt: new Date(), isActive: true } }),
      prisma.client.create({ data: { name: `package-access-other-${suffix}`, email: `package-access-other-${suffix}@sawaa.test`, accountType: 'FULL', claimedAt: new Date(), isActive: true } }),
    ]);
    ownerId = owner.id;
    otherClientId = other.id;

    const pending = await prisma.packagePurchase.create({
      data: {
        packageId,
        clientId: ownerId,
        branchId,
        status: 'PENDING',
        subtotalSnapshot: 20_000,
        discountSnapshot: 0,
        amountPaid: 0,
        paidAt: new Date(),
        refundAmount: 0,
        notes: 'internal pending note',
      },
    });
    ownerPendingPurchaseId = pending.id;

    const pendingCredit = await prisma.packageCredit.create({
      data: {
        purchaseId: pending.id,
        unitPriceSnapshot: 20_000,
        totalQuantity: 1,
        usedQuantity: 0,
        reservedQuantity: 0,
      },
    });
    ownerPendingCreditId = pendingCredit.id;

    const active = await prisma.packagePurchase.create({
      data: {
        packageId,
        clientId: ownerId,
        branchId,
        status: 'ACTIVE',
        subtotalSnapshot: 20_000,
        discountSnapshot: 0,
        amountPaid: 20_000,
        paidAt: new Date(),
        refundAmount: 0,
        notes: 'internal active note',
      },
    });
    const reserved = await prisma.packageCredit.create({
      data: {
        purchaseId: active.id,
        unitPriceSnapshot: 20_000,
        totalQuantity: 1,
        usedQuantity: 0,
        reservedQuantity: 1,
      },
    });
    ownerReservedCreditId = reserved.id;

    const otherPurchase = await prisma.packagePurchase.create({
      data: {
        packageId,
        clientId: otherClientId,
        branchId,
        status: 'ACTIVE',
        subtotalSnapshot: 20_000,
        discountSnapshot: 0,
        amountPaid: 20_000,
        paidAt: new Date(),
        refundAmount: 0,
      },
    });
    otherPurchaseId = otherPurchase.id;
    const otherCredit = await prisma.packageCredit.create({
      data: {
        purchaseId: otherPurchase.id,
        unitPriceSnapshot: 20_000,
        totalQuantity: 1,
        usedQuantity: 0,
        reservedQuantity: 0,
      },
    });
    otherCreditId = otherCredit.id;
  });

  afterAll(async () => {
    try {
      if (!prisma) return;
      const del = (operation: () => Promise<unknown>) => operation().catch(() => undefined);
      await del(() => prisma.packageCredit.deleteMany({ where: { purchaseId: { in: [ownerPendingPurchaseId, otherPurchaseId].filter(Boolean) } } }));
      await del(() => prisma.packagePurchase.deleteMany({ where: { id: { in: [ownerPendingPurchaseId, otherPurchaseId].filter(Boolean) } } }));
      // The active owner purchase has no externally referenced booking; delete
      // its credits and purchase by client/suffix after the assertions.
      await del(() => prisma.packageCredit.deleteMany({ where: { purchase: { clientId: ownerId } } }));
      await del(() => prisma.packagePurchase.deleteMany({ where: { clientId: ownerId, packageId } }));
      await del(() => prisma.client.deleteMany({ where: { id: { in: [ownerId, otherClientId].filter(Boolean) } } }));
    } finally {
      await app?.close();
    }
  });

  const tokenFor = (clientId: string) => jwt.sign(
    { sub: clientId, email: null, namespace: 'client', jti: randomUUID(), tokenVersion: 0 },
    { secret: process.env.JWT_CLIENT_ACCESS_SECRET },
  );

  const auth = (clientId: string) => ({ Authorization: `Bearer ${tokenFor(clientId)}` });
  // createRealE2eApp applies the production HTTP contract: /api + URI v1.
  const api = (path: string) => `/api/v1${path}`;

  it('lists only the caller-owned decorated purchases through both route aliases', async () => {
    for (const path of ['/mobile/client/packages/purchases', '/public/me/packages/purchases']) {
      const response = await request(app.getHttpServer()).get(api(path)).set(auth(ownerId));
      expect(response.status).toBe(200);
      expect(response.body.map((purchase: { id: string }) => purchase.id)).toEqual(
        expect.arrayContaining([ownerPendingPurchaseId]),
      );
      expect(response.body.map((purchase: { id: string }) => purchase.id)).not.toContain(otherPurchaseId);
      expect(response.body[0]).not.toHaveProperty('notes');
    }
  });

  it('returns the pending owned purchase shape and hides another client purchase', async () => {
    const own = await request(app.getHttpServer())
      .get(api(`/public/me/packages/purchases/${ownerPendingPurchaseId}`))
      .set(auth(ownerId));
    expect(own.status).toBe(200);
    expect(own.body).toEqual(expect.objectContaining({ id: ownerPendingPurchaseId, status: 'PENDING', credits: expect.any(Array) }));
    expect(own.body).not.toHaveProperty('notes');

    const other = await request(app.getHttpServer())
      .get(api(`/mobile/client/packages/purchases/${otherPurchaseId}`))
      .set(auth(ownerId));
    expect(other.status).toBe(404);
  });

  it('does not let a client book another client credit', async () => {
    const response = await request(app.getHttpServer())
      .post(api('/public/me/packages/book'))
      .set(auth(ownerId))
      .send({ creditId: otherCreditId, branchId, scheduledAt: '2026-12-01T10:00:00.000Z' });

    expect(response.status).toBe(404);
  });

  it('does not activate pending credit and rejects a reserved credit', async () => {
    const pending = await request(app.getHttpServer())
      .post(api('/mobile/client/packages/book'))
      .set(auth(ownerId))
      .send({ creditId: ownerPendingCreditId, branchId, scheduledAt: '2026-12-01T10:00:00.000Z' });
    expect(pending.status).toBe(400);
    await expect(prisma.packagePurchase.findUnique({ where: { id: ownerPendingPurchaseId }, select: { status: true } }))
      .resolves.toEqual({ status: 'PENDING' });
    await expect(prisma.packageCredit.findUnique({ where: { id: ownerPendingCreditId }, select: { usedQuantity: true, reservedQuantity: true } }))
      .resolves.toEqual({ usedQuantity: 0, reservedQuantity: 0 });

    const reserved = await request(app.getHttpServer())
      .post(api('/public/me/packages/book'))
      .set(auth(ownerId))
      .send({ creditId: ownerReservedCreditId, branchId, scheduledAt: '2026-12-01T11:00:00.000Z' });
    expect(reserved.status).toBe(409);
  });
});
