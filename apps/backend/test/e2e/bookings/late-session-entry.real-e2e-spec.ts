import { hashToInt32 } from "../../../src/modules/bookings/booking-lifecycle.helper";
import { RecordLateSessionHandler } from "../../../src/modules/bookings/record-late-session/record-late-session.handler";
import { RecordPreviousReceiptHandler } from "../../../src/modules/finance/record-previous-receipt/record-previous-receipt.handler";
import { ProcessPaymentHandler } from "../../../src/modules/finance/process-payment/process-payment.handler";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../src/infrastructure/database";
import { createRealE2eApp, request } from "../../helpers/create-real-e2e-app";
import { RecordLateSessionDto } from "../../../src/modules/bookings/record-late-session/record-late-session.dto";

const describeReal = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;
/** All rows are synthetic in the guarded disposable test database. No provider calls. */
describeReal(
  "Late session recording — real HTTP, transactions and concurrency",
  () => {
    jest.setTimeout(60_000);
    let app: INestApplication, prisma: PrismaService;
    let adminToken: string,
      restrictedToken: string,
      receptionistToken: string,
      noCreateToken: string,
      adminId: string,
      settingsId: string;
    const suffix = randomUUID();
    const route = "/api/v1/dashboard/bookings/late-entry";
    beforeAll(async () => {
      ({ app, prisma } = await createRealE2eApp());
      const jwt = app.get(JwtService);
      const admin = await prisma.user.create({
        data: {
          email: `late-admin-${suffix}@sawaa.test`,
          name: "Late entry administrator",
          role: "SUPER_ADMIN",
          isSuperAdmin: true,
        },
      });
      adminId = admin.id;
      adminToken = jwt.sign({
        sub: admin.id,
        role: admin.role,
        tokenVersion: 0,
      });
      const role = await prisma.customRole.create({
        data: {
          name: `late-booking-only-${suffix}`,
          permissions: { create: [{ action: "create", subject: "Booking" }] },
        },
      });
      const restricted = await prisma.user.create({
        data: {
          email: `late-limited-${suffix}@sawaa.test`,
          name: "Booking-only employee",
          role: "EMPLOYEE",
          customRoleId: role.id,
        },
      });
      restrictedToken = jwt.sign({
        sub: restricted.id,
        role: restricted.role,
        tokenVersion: 0,
      });
      const receptionist = await prisma.user.create({
        data: {
          email: `late-reception-${suffix}@sawaa.test`,
          name: "Reception",
          role: "RECEPTIONIST",
        },
      });
      receptionistToken = jwt.sign({
        sub: receptionist.id,
        role: receptionist.role,
        tokenVersion: 0,
      });
      const noCreate = await prisma.user.create({
        data: {
          email: `late-read-only-${suffix}@sawaa.test`,
          name: "Practitioner",
          role: "EMPLOYEE",
        },
      });
      noCreateToken = jwt.sign({
        sub: noCreate.id,
        role: noCreate.role,
        tokenVersion: 0,
      });
      settingsId = (
        await prisma.organizationSettings.create({
          data: {
            companyNameAr: `late-test-${suffix}`,
            vatRate: 0,
            payMethodCashEnabled: true,
            payMethodMadaEnabled: false,
          },
        })
      ).id;
    });
    afterAll(async () => {
      if (app) await app.close();
    });

    async function fixture(): Promise<RecordLateSessionDto> {
      const branch = await prisma.branch.create({
        data: { nameAr: `late-branch-${randomUUID()}`, isActive: false },
      });
      const client = await prisma.client.create({
        data: { name: "Late entry client" },
      });
      const employee = await prisma.employee.create({
        data: { name: "Archived practitioner", isActive: false },
      });
      const service = await prisma.service.create({
        data: {
          nameAr: "Archived session",
          durationMins: 45,
          price: 50000,
          currency: "SAR",
          isActive: false,
          archivedAt: new Date(),
          depositEnabled: true,
          depositAmount: 20000,
        },
      });
      await prisma.employeeBranch.create({
        data: { employeeId: employee.id, branchId: branch.id },
      });
      await prisma.employeeService.create({
        data: {
          employeeId: employee.id,
          serviceId: service.id,
          isActive: false,
        },
      });
      const key = `late-e2e-${randomUUID()}`;
      return {
        clientId: client.id,
        branchId: branch.id,
        employeeId: employee.id,
        serviceId: service.id,
        deliveryType: "IN_PERSON",
        scheduledAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        durationMins: 60,
        status: "COMPLETED",
        amountHalalas: 40000,
        paymentMode: "UNPAID",
        creationIdempotencyKey: key,
      };
    }
    const post = (
      dto: Record<string, unknown> | RecordLateSessionDto,
      token = adminToken,
    ) =>
      request(app.getHttpServer())
        .post(route)
        .set("Authorization", `Bearer ${token}`)
        .send(dto);
    function previous(dto: RecordLateSessionDto): RecordLateSessionDto {
      return {
        ...dto,
        paymentMode: "PREVIOUSLY_RECEIVED",
        paymentMethod: "CASH",
        paymentAmountHalalas: 15000,
        receivedAt: new Date(Date.now() - 35 * 86400000).toISOString(),
        receiptEvidenceRef: "paper-150",
        receiptEntryReason: "Reception paper ledger",
      };
    }

    it("records an unpaid archived session with current audit and no payment event", async () => {
      const dto = await fixture(),
        before = new Date();
      const response = await post(dto).expect(201);
      const row = await prisma.booking.findUniqueOrThrow({
        where: { creationIdempotencyKey: dto.creationIdempotencyKey },
      });
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { bookingId: row.id },
      });
      expect(response.body).toMatchObject({
        isLateEntry: true,
        outstanding: 40000,
        payment: null,
        booking: { isLateEntry: true, status: "completed" },
      });
      expect(row.lateEntryRecordedBy).toBe(adminId);
      expect(row.lateEntryRecordedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(row.completedAt!.getTime()).toBe(
        new Date(dto.scheduledAt).getTime() + 3600000,
      );
      expect(invoice.status).toBe("DRAFT");
      expect(invoice.issuedAt).toBeNull();
      expect(
        await prisma.payment.count({ where: { invoiceId: invoice.id } }),
      ).toBe(0);
      expect(
        await prisma.outboxEvent.count({
          where: { aggregateId: { in: [row.id, invoice.id] } },
        }),
      ).toBe(0);
    });
    it("concurrent identical requests commit one booking, invoice, previous receipt and event", async () => {
      const dto = previous(await fixture()),
        before = new Date();
      const responses = await Promise.all([post(dto), post(dto)]);
      expect(responses.map((r) => r.status)).toEqual([201, 201]);
      expect(responses[0].body.booking.id).toBe(responses[1].body.booking.id);
      expect(responses[0].body).toMatchObject({
        outstanding: 25000,
        invoice: { status: "PARTIALLY_PAID" },
      });
      expect(
        await prisma.booking.count({
          where: { creationIdempotencyKey: dto.creationIdempotencyKey },
        }),
      ).toBe(1);
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { bookingId: responses[0].body.booking.id },
        include: { payments: true },
      });
      expect(invoice.payments).toHaveLength(1);
      expect(invoice.payments[0].effectiveReceivedAt!.toISOString()).toBe(
        dto.receivedAt,
      );
      expect(invoice.payments[0].processedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(invoice.issuedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(invoice.paidAt).toBeNull();
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: invoice.id,
            eventType: "finance.previous-receipt.recorded",
          },
        }),
      ).toBe(1);
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: invoice.id,
            eventType: {
              in: ["finance.payment.completed", "finance.payment.deposit_paid"],
            },
          },
        }),
      ).toBe(0);
      await prisma.client.update({
        where: { id: dto.clientId },
        data: { deletedAt: new Date(), isActive: false },
      });
      await post(dto).expect(201);
      for (const change of [
        { receivedAt: new Date(Date.now() - 36 * 86400000).toISOString() },
        { receiptEvidenceRef: "other-proof" },
        { paymentAmountHalalas: 14000 },
      ])
        await post({ ...dto, ...change }).expect(409);
    });
    it("rolls back every write on present-day deposit rejection and permits reuse of the key", async () => {
      const dto = await fixture();
      await post({
        ...dto,
        paymentMode: "COLLECT_NOW",
        paymentMethod: "CASH",
        paymentAmountHalalas: 15000,
      }).expect(400);
      expect(
        await prisma.booking.count({
          where: { creationIdempotencyKey: dto.creationIdempotencyKey },
        }),
      ).toBe(0);
      expect(
        await prisma.invoice.count({ where: { clientId: dto.clientId } }),
      ).toBe(0);
      expect(
        await prisma.payment.count({
          where: { idempotencyKey: `late:${dto.creationIdempotencyKey}` },
        }),
      ).toBe(0);
      await post(previous(dto)).expect(201);
    });
    it("keeps selected status after a valid present-day deposit and stages its financial event", async () => {
      const dto = {
        ...(await fixture()),
        status: "CONFIRMED" as const,
        paymentMode: "COLLECT_NOW" as const,
        paymentMethod: "CASH" as const,
        paymentAmountHalalas: 20000,
      };
      const res = await post(dto).expect(201);
      expect(res.body).toMatchObject({
        outstanding: 20000,
        booking: { status: "confirmed" },
      });
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: res.body.booking.id },
      });
      expect(booking.status).toBe("CONFIRMED");
      expect(booking.confirmedAt).toBeNull();
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: res.body.invoice.id,
            eventType: "finance.payment.deposit_paid",
          },
        }),
      ).toBe(1);
    });
    it("enforces actual CASL permissions conditionally, including zero-money recording", async () => {
      const dto = await fixture();
      await post(dto, restrictedToken).expect(403);
      await post({ ...dto, amountHalalas: 0 }, restrictedToken).expect(201);
      await post(previous(await fixture()), restrictedToken).expect(403);
    });
    it("rejects spoofed audit fields, external invoices, overpayment and terminal receipts before any persisted booking", async () => {
      const dto = await fixture();
      for (const extra of [
        { createdAt: "2020-01-01" },
        { lateEntryRecordedBy: randomUUID() },
        { invoiceId: randomUUID() },
        { externalInvoiceNumber: "outside" },
        { ...previous(dto), paymentAmountHalalas: 40001 },
        { ...previous(dto), status: "NO_SHOW", noShowAt: dto.scheduledAt },
      ]) {
        await post({ ...dto, ...extra }).expect(400);
        expect(
          await prisma.booking.count({
            where: { creationIdempotencyKey: dto.creationIdempotencyKey },
          }),
        ).toBe(0);
      }
    });
    it("rejects overlap, absent bindings and deletion committed ahead of the person lock", async () => {
      const dto = await fixture();
      await post(dto).expect(201);
      await post({
        ...dto,
        creationIdempotencyKey: `late-overlap-${randomUUID()}`,
      }).expect(409);
      const unbound = await fixture();
      await prisma.employeeService.deleteMany({
        where: { employeeId: unbound.employeeId },
      });
      await post(unbound).expect(400);
      const deleted = await fixture();
      let acquired!: () => void, release!: () => void;
      const locked = new Promise<void>((resolve) => {
          acquired = resolve;
        }),
        released = new Promise<void>((resolve) => {
          release = resolve;
        });
      const deletion = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Client" WHERE id=${deleted.clientId} FOR UPDATE`;
          acquired();
          await released;
          await tx.client.update({
            where: { id: deleted.clientId },
            data: { deletedAt: new Date(), isActive: false },
          });
        },
        { timeout: 15000 },
      );
      await locked;
      const recording = post(deleted).then((response) => response);
      release();
      await deletion;
      expect((await recording).status).toBe(404);
      expect(
        await prisma.booking.count({
          where: { creationIdempotencyKey: deleted.creationIdempotencyKey },
        }),
      ).toBe(0);
    });

    it("rejects unsupported calendar/zone formats for every fact date through HTTP without hash errors", async () => {
      const dto = await fixture();
      for (const field of [
        "scheduledAt",
        "receivedAt",
        "cancelledAt",
        "noShowAt",
      ]) {
        const context =
          field === "receivedAt"
            ? previous(dto)
            : field === "cancelledAt"
              ? {
                  ...dto,
                  status: "CANCELLED",
                  amountHalalas: 0,
                  cancellationReason: "reason",
                }
              : field === "noShowAt"
                ? { ...dto, status: "NO_SHOW", amountHalalas: 0 }
                : dto;
        for (const value of [
          "2026-02-31T10:00:00Z",
          "2026-W05-1T10:00:00Z",
          "2026-032T10:00:00Z",
          "2026-09-01",
          "2026-09-01T10:00:00",
        ]) {
          await post({ ...context, [field]: value }).expect(400);
        }
      }
      expect(
        await prisma.booking.count({
          where: { creationIdempotencyKey: dto.creationIdempotencyKey },
        }),
      ).toBe(0);
    });

    it("returns usable ordinary and imported overlap conflicts without altering the blocking booking", async () => {
      const dto = { ...(await fixture()), amountHalalas: 0 };
      const first = await post(dto).expect(201);
      const ordinary = await post({
        ...dto,
        creationIdempotencyKey: randomUUID(),
      }).expect(409);
      expect(ordinary.body).toMatchObject({
        code: "ALREADY_RECORDED_SESSION",
        bookingId: first.body.booking.id,
        message: expect.stringContaining("existing booking"),
      });
      const imported = await fixture();
      const row = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32("booking_number")}::int,0::int)`;
        const last = await tx.booking.findFirst({
          orderBy: { bookingNumber: "desc" },
          select: { bookingNumber: true },
        });
        return tx.booking.create({
          data: {
            clientId: imported.clientId,
            employeeId: imported.employeeId,
            branchId: imported.branchId,
            serviceId: imported.serviceId,
            scheduledAt: new Date(imported.scheduledAt),
            endsAt: new Date(
              new Date(imported.scheduledAt).getTime() + 3600000,
            ),
            durationMins: 60,
            price: 0,
            bookingNumber: (last?.bookingNumber ?? 0) + 1,
            deliveryType: "IN_PERSON",
            status: "COMPLETED",
            isHistoricalImport: true,
          },
        });
      });
      const conflict = await post(imported).expect(409);
      expect(conflict.body).toMatchObject({
        code: "ALREADY_RECORDED_SESSION",
        bookingId: row.id,
        message: expect.stringContaining("existing booking"),
      });
      expect(
        await prisma.booking.findUnique({ where: { id: row.id } }),
      ).toEqual(row);
      expect(
        await prisma.booking.count({
          where: { creationIdempotencyKey: imported.creationIdempotencyKey },
        }),
      ).toBe(0);
    });

    it("allows exactly one concurrent different-key claim on the same practitioner slot", async () => {
      const dto = await fixture();
      const otherClient = await prisma.client.create({
        data: { name: "Concurrent session client" },
      });
      const responses = await Promise.all([
        post(dto),
        post({
          ...dto,
          clientId: otherClient.id,
          creationIdempotencyKey: randomUUID(),
        }),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
      const success = responses.find((r) => r.status === 201)!;
      const conflict = responses.find((r) => r.status === 409)!;
      expect(conflict.body).toMatchObject({
        code: "ALREADY_RECORDED_SESSION",
        bookingId: success.body.booking.id,
        message: expect.stringContaining("existing booking"),
      });
      expect(
        await prisma.booking.count({ where: { employeeId: dto.employeeId } }),
      ).toBe(1);
      expect(
        await prisma.invoice.count({ where: { employeeId: dto.employeeId } }),
      ).toBe(1);
    });

    it("rolls back real booking, invoice, payment and status writes when final outbox insertion fails", async () => {
      const dto = previous(await fixture());
      let bookingId: string | undefined;
      const transactions = {
        withTransaction: (run: any, options: any) =>
          prisma.$transaction(async (tx) => {
            const wrapped = new Proxy(tx, {
              get(target, property, receiver) {
                if (property === "booking")
                  return new Proxy(target.booking, {
                    get(delegate, key) {
                      if (key === "create")
                        return async (args: any) => {
                          const row = await delegate.create(args);
                          bookingId = row.id;
                          return row;
                        };
                      const value = Reflect.get(delegate, key);
                      return typeof value === "function"
                        ? value.bind(delegate)
                        : value;
                    },
                  });
                if (property === "outboxEvent")
                  return new Proxy(target.outboxEvent, {
                    get(delegate, key) {
                      if (key === "create")
                        return async () => {
                          throw new Error("injected final outbox failure");
                        };
                      const value = Reflect.get(delegate, key);
                      return typeof value === "function"
                        ? value.bind(delegate)
                        : value;
                    },
                  });
                const value = Reflect.get(target, property, receiver);
                return typeof value === "function" ? value.bind(target) : value;
              },
            });
            return run(wrapped);
          }, options),
      };
      const handler = new RecordLateSessionHandler(
        transactions as never,
        app.get(RecordPreviousReceiptHandler),
        app.get(ProcessPaymentHandler),
      );
      await expect(
        handler.execute(dto, {
          sub: adminId,
          roles: [],
          permissions: [{ action: "manage", subject: "all" }],
        }),
      ).rejects.toThrow("injected final outbox failure");
      expect(bookingId).toBeDefined();
      expect(await prisma.booking.count({ where: { id: bookingId } })).toBe(0);
      expect(
        await prisma.bookingStatusLog.count({ where: { bookingId } }),
      ).toBe(0);
      expect(
        await prisma.invoice.count({ where: { clientId: dto.clientId } }),
      ).toBe(0);
      expect(
        await prisma.payment.count({
          where: { idempotencyKey: `late:${dto.creationIdempotencyKey}` },
        }),
      ).toBe(0);
      await post(dto).expect(201);
    });

    it("allows the narrow reception context through existing createBooking permission and rejects other staff", async () => {
      const result = await request(app.getHttpServer())
        .get(`${route}/context`)
        .set("Authorization", `Bearer ${receptionistToken}`)
        .expect(200);
      expect(result.body).toEqual({
        vatRate: 0,
        paymentMethods: ["CASH", "BANK_TRANSFER"],
      });
      await request(app.getHttpServer())
        .get("/api/v1/dashboard/organization/settings")
        .set("Authorization", `Bearer ${receptionistToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get(`${route}/context`)
        .set("Authorization", `Bearer ${noCreateToken}`)
        .expect(403);
      await request(app.getHttpServer()).get(`${route}/context`).expect(401);
    });

    it("records net and VAT separately with a nonzero fixture without changing the default", async () => {
      await prisma.organizationSettings.update({
        where: { id: settingsId },
        data: { vatRate: "0.05" },
      });
      try {
        const context = await request(app.getHttpServer())
          .get(`${route}/context`)
          .set("Authorization", `Bearer ${receptionistToken}`)
          .expect(200);
        expect(context.body).toEqual({
          vatRate: 0.05,
          paymentMethods: ["CASH", "BANK_TRANSFER"],
        });
        const res = await post(await fixture()).expect(201);
        expect(res.body).toMatchObject({
          outstanding: 42000,
          invoice: { subtotal: 40000, vatAmt: 2000, total: 42000 },
        });
      } finally {
        await prisma.organizationSettings.update({
          where: { id: settingsId },
          data: { vatRate: 0 },
        });
      }
    });
  },
);
