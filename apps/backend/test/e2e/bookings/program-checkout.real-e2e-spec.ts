/**
 * Real PostgreSQL enrollment idempotency/concurrency coverage.
 *
 * Run with REAL_E2E_DATABASE_URL pointing at a migrated disposable test DB.
 * The suite is intentionally skipped when that explicit environment variable
 * is absent; it never falls back to a developer or production database.
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { PrismaService } from '../../../src/infrastructure/database';
import { EnrollInProgramHandler } from '../../../src/modules/bookings/enroll-in-program/enroll-in-program.handler';
import { UpdateProgramHandler } from '../../../src/modules/bookings/update-program/update-program.handler';
import { ClientTokenService } from '../../../src/modules/identity/shared/client-token.service';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('program enrollment checkout concurrency (real PostgreSQL)', () => {
  jest.setTimeout(60_000);

  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let clientTokens: ClientTokenService;

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
    clientTokens = app.get(ClientTokenService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('converges concurrent same-client enrollment calls on one seat, booking, and invoice', async () => {
    const ids = {
      branchId: randomUUID(),
      employeeId: randomUUID(),
      clientId: randomUUID(),
      programId: randomUUID(),
    };

    await prisma.branch.create({
      data: { id: ids.branchId, nameAr: `checkout-${ids.branchId}`, isActive: true },
    });
    await prisma.employee.create({
      data: { id: ids.employeeId, name: `checkout-${ids.employeeId}`, isActive: true },
    });
    await prisma.client.create({
      data: { id: ids.clientId, name: `checkout-${ids.clientId}`, isActive: true },
    });
    await prisma.program.create({
      data: {
        id: ids.programId,
        departmentId: randomUUID(),
        branchId: ids.branchId,
        nameAr: `Checkout ${ids.programId}`,
        daysCount: 1,
        hoursPerDay: 1,
        minParticipants: 1,
        maxParticipants: 1,
        enrolledCount: 0,
        price: 10_000,
        currency: 'SAR',
        status: 'OPEN',
        isPublic: true,
      },
    });
    await prisma.programSupervisor.create({
      data: { programId: ids.programId, employeeId: ids.employeeId },
    });

    try {
      const handler = app.get(EnrollInProgramHandler);
      const attempts = await Promise.allSettled([
        handler.execute({ programId: ids.programId, clientId: ids.clientId }),
        handler.execute({ programId: ids.programId, clientId: ids.clientId }),
      ]);

      const fulfilled = attempts.filter(
        (attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<EnrollInProgramHandler['execute']>>> =>
          attempt.status === 'fulfilled',
      );
      expect(fulfilled).toHaveLength(2);
      expect(fulfilled[0].value).toEqual(fulfilled[1].value);
      expect(fulfilled[0].value.status).toBe('AWAITING_PAYMENT');
      expect(fulfilled[0].value.invoiceId).toEqual(expect.any(String));

      expect(
        await prisma.programEnrollment.count({ where: { programId: ids.programId } }),
      ).toBe(1);
      expect(
        await prisma.booking.count({ where: { programId: ids.programId } }),
      ).toBe(1);
      expect(
        await prisma.invoice.count({ where: { bookingId: fulfilled[0].value.bookingId } }),
      ).toBe(1);
      expect(
        await prisma.program.findUnique({ where: { id: ids.programId }, select: { enrolledCount: true } }),
      ).toEqual({ enrolledCount: 1 });

      await request(app.getHttpServer())
        .post(`/api/v1/mobile/client/programs/${ids.programId}/enroll`)
        .expect(401);

      const tokenPair = await clientTokens.issueTokenPair({ id: ids.clientId, email: null });
      const httpResponse = await request(app.getHttpServer())
        .post(`/api/v1/mobile/client/programs/${ids.programId}/enroll`)
        .set('Authorization', `Bearer ${tokenPair.accessToken}`)
        .expect(201);
      expect(httpResponse.body).toEqual(fulfilled[0].value);
      expect(
        await prisma.programEnrollment.count({ where: { programId: ids.programId } }),
      ).toBe(1);
    } finally {
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: ids.clientId } }).catch(() => undefined);
      const createdBookings = await prisma.booking.findMany({
        where: { programId: ids.programId },
        select: { id: true },
      }).catch(() => [] as Array<{ id: string }>);
      await prisma.invoice.deleteMany({
        where: { bookingId: { in: createdBookings.map((booking) => booking.id) } },
      }).catch(() => undefined);
      await prisma.programEnrollment.deleteMany({ where: { programId: ids.programId } }).catch(() => undefined);
      await prisma.booking.deleteMany({ where: { programId: ids.programId } }).catch(() => undefined);
      await prisma.programSupervisor.deleteMany({ where: { programId: ids.programId } }).catch(() => undefined);
      await prisma.program.deleteMany({ where: { id: ids.programId } }).catch(() => undefined);
      await prisma.client.deleteMany({ where: { id: ids.clientId } }).catch(() => undefined);
      await prisma.employee.deleteMany({ where: { id: ids.employeeId } }).catch(() => undefined);
      await prisma.branch.deleteMany({ where: { id: ids.branchId } }).catch(() => undefined);
    }
  });

  it('refuses to lower capacity below the participants already enrolled', async () => {
    const branchId = randomUUID();
    const programId = randomUUID();
    await prisma.branch.create({ data: { id: branchId, nameAr: `capacity-${branchId}`, isActive: true } });
    await prisma.program.create({
      data: {
        id: programId, departmentId: randomUUID(), branchId, nameAr: `Capacity ${programId}`,
        daysCount: 1, hoursPerDay: 1, minParticipants: 1, maxParticipants: 5, enrolledCount: 3,
        price: 10_000, currency: 'SAR', status: 'OPEN', isPublic: true,
      },
    });
    try {
      const update = app.get(UpdateProgramHandler);
      await expect(update.execute(programId, { maxParticipants: 2 } as never)).rejects.toThrow(/already enrolled/);
      expect((await prisma.program.findUniqueOrThrow({ where: { id: programId } })).maxParticipants).toBe(5);

      await update.execute(programId, { maxParticipants: 3 } as never);
      expect((await prisma.program.findUniqueOrThrow({ where: { id: programId } })).maxParticipants).toBe(3);
    } finally {
      await prisma.program.deleteMany({ where: { id: programId } }).catch(() => undefined);
      await prisma.branch.deleteMany({ where: { id: branchId } }).catch(() => undefined);
    }
  });

  it('gives the last seat to exactly one of two different clients enrolling at once', async () => {
    const ids = {
      branchId: randomUUID(), employeeId: randomUUID(), programId: randomUUID(),
      clientA: randomUUID(), clientB: randomUUID(),
    };
    await prisma.branch.create({ data: { id: ids.branchId, nameAr: `seat-${ids.branchId}`, isActive: true } });
    await prisma.employee.create({ data: { id: ids.employeeId, name: `seat-${ids.employeeId}`, isActive: true } });
    await prisma.client.createMany({ data: [
      { id: ids.clientA, name: `seat-a-${ids.clientA}`, isActive: true },
      { id: ids.clientB, name: `seat-b-${ids.clientB}`, isActive: true },
    ] });
    await prisma.program.create({
      data: {
        id: ids.programId, departmentId: randomUUID(), branchId: ids.branchId, nameAr: `Seat ${ids.programId}`,
        daysCount: 1, hoursPerDay: 1, minParticipants: 1, maxParticipants: 1, enrolledCount: 0,
        price: 10_000, currency: 'SAR', status: 'OPEN', isPublic: true,
      },
    });
    await prisma.programSupervisor.create({ data: { programId: ids.programId, employeeId: ids.employeeId } });

    try {
      const handler = app.get(EnrollInProgramHandler);
      const attempts = await Promise.allSettled([
        handler.execute({ programId: ids.programId, clientId: ids.clientA }),
        handler.execute({ programId: ids.programId, clientId: ids.clientB }),
      ]);

      expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter((a) => a.status === 'rejected')).toHaveLength(1);
      expect(await prisma.programEnrollment.count({ where: { programId: ids.programId } })).toBe(1);
      expect(await prisma.program.findUniqueOrThrow({ where: { id: ids.programId }, select: { enrolledCount: true } }))
        .toEqual({ enrolledCount: 1 });
    } finally {
      const bookings = await prisma.booking.findMany({ where: { programId: ids.programId }, select: { id: true } }).catch(() => [] as Array<{ id: string }>);
      await prisma.invoice.deleteMany({ where: { bookingId: { in: bookings.map((b) => b.id) } } }).catch(() => undefined);
      await prisma.programEnrollment.deleteMany({ where: { programId: ids.programId } }).catch(() => undefined);
      await prisma.booking.deleteMany({ where: { programId: ids.programId } }).catch(() => undefined);
      await prisma.programSupervisor.deleteMany({ where: { programId: ids.programId } }).catch(() => undefined);
      await prisma.program.deleteMany({ where: { id: ids.programId } }).catch(() => undefined);
      await prisma.client.deleteMany({ where: { id: { in: [ids.clientA, ids.clientB] } } }).catch(() => undefined);
      await prisma.employee.deleteMany({ where: { id: ids.employeeId } }).catch(() => undefined);
      await prisma.branch.deleteMany({ where: { id: ids.branchId } }).catch(() => undefined);
    }
  });
});
