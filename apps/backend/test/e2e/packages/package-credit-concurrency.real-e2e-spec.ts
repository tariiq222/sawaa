/**
 * Package credit lifecycle races against real Postgres.
 *
 * Each case drives the actual handlers and reads the resulting
 * PackageCredit, PackageCreditUsage, and PackagePurchase rows back from the
 * database. The synchronization barriers are placed before a purchase lock
 * or after the lock has been acquired, and are always released before the
 * competing transaction is awaited.
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { CancellationReason } from "@prisma/client";
import { RlsTransactionService } from "../../../src/common/database/rls-transaction";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";
import { MoyasarApiClient } from "../../../src/modules/finance/moyasar-api/moyasar-api.client";
import { RefundPackagePurchaseHandler } from "../../../src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler";
import { BookFromCreditHandler } from "../../../src/modules/bookings/book-from-credit/book-from-credit.handler";
import { CheckInBookingHandler } from "../../../src/modules/bookings/check-in-booking/check-in-booking.handler";
import { CancelBookingHandler } from "../../../src/modules/bookings/cancel-booking/cancel-booking.handler";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Package credit concurrency lifecycle", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let bookHandler: BookFromCreditHandler;
  let checkInHandler: CheckInBookingHandler;
  let cancelHandler: CancelBookingHandler;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `reserve-consume-${suffix}-${label}`;

  const ids = {
    branchId: "",
    serviceId: "",
    durationOptionId: "",
    employeeId: "",
    clientId: "",
    adminUserId: "",
  };

  // Track entities for cleanup — several credit bundles are seeded, one per
  // scenario, so these are arrays rather than single ids.
  const bookingIds: string[] = [];
  const purchaseIds: string[] = [];
  const packageIds: string[] = [];
  const creditIds: string[] = [];

  // Days-from-now offset used for the next seeded booking's scheduledAt.
  // Each scenario gets its own day (same employee across the whole file) so
  // bookings never overlap and never trip the
  // booking_staff_active_time_no_overlap DB backstop.
  let dayOffset = 4;
  function nextSlot(): Date {
    const scheduledAt = new Date(Date.now() + dayOffset * 24 * 3_600_000);
    dayOffset += 1;
    scheduledAt.setHours(10, 0, 0, 0);
    return scheduledAt;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MoyasarApiClient)
      .useValue({
        createPayment: jest.fn(),
        createRefund: jest.fn(),
        getPaymentStatus: jest.fn(),
        getRefundStatus: jest.fn(),
        invalidate: jest.fn(),
        toPaymentStatus: jest.fn(),
        toPaymentMethod: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix("api/v1");
    await app.init();

    prisma = app.get(PrismaService);
    bookHandler = app.get(BookFromCreditHandler);
    checkInHandler = app.get(CheckInBookingHandler);
    cancelHandler = app.get(CancelBookingHandler);
    await prisma.$queryRaw`SELECT 1`;

    await seedBaseEntities();
  });

  afterAll(async () => {
    await cleanup().catch(() => undefined);
    if (app) await app.close();
  });

  // ─── Seed: minimal entities to make a credit booking possible ──────────
  async function seedBaseEntities() {
    const existingOrg = await prisma.organizationSettings.findFirst();
    if (existingOrg) {
      await prisma.organizationSettings.update({
        where: { id: existingOrg.id },
        data: { vatRate: "0", paymentAtClinicEnabled: false },
      });
    } else {
      await prisma.organizationSettings.create({
        data: { vatRate: "0", paymentAtClinicEnabled: false },
      });
    }
    const existingBookingSettings = await prisma.bookingSettings.findFirst({
      where: { branchId: null },
    });
    if (!existingBookingSettings) {
      await prisma.bookingSettings.create({
        data: {
          branchId: null,
          minBookingLeadMinutes: 60,
          maxAdvanceBookingDays: 90,
          requireCancelApproval: false,
          autoRefundOnCancel: true,
        },
      });
    }

    const admin = await prisma.user.create({
      data: {
        email: `reserve-consume-${suffix}-admin@sawaa.test`,
        passwordHash: "not-used",
        name: tag("Admin"),
        role: "ADMIN",
        isActive: true,
      },
    });
    ids.adminUserId = admin.id;

    const branch = await prisma.branch.create({
      data: { nameAr: tag("branch"), nameEn: tag("branch-en"), isActive: true },
    });
    ids.branchId = branch.id;

    const dept = await prisma.department.create({
      data: { nameAr: tag("dept"), nameEn: tag("dept-en"), isActive: true },
    });

    const cat = await prisma.serviceCategory.create({
      data: {
        nameAr: tag("cat"),
        nameEn: tag("cat-en"),
        departmentId: dept.id,
        isActive: true,
      },
    });

    const emp = await prisma.employee.create({
      data: {
        name: tag("emp"),
        nameAr: tag("emp"),
        nameEn: tag("emp-en"),
        email: `reserve-consume-${suffix}-emp@sawaa.test`,
        phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        isActive: true,
      },
    });
    ids.employeeId = emp.id;

    const svc = await prisma.service.create({
      data: {
        nameAr: tag("svc"),
        nameEn: tag("svc-en"),
        durationMins: 60,
        price: 30_000,
        currency: "SAR",
        isActive: true,
        categoryId: cat.id,
      },
    });
    ids.serviceId = svc.id;

    await prisma.serviceBookingConfig.create({
      data: { serviceId: svc.id, deliveryType: "IN_PERSON", useCustomAvailability: false },
    });

    const dur = await prisma.serviceDurationOption.create({
      data: {
        serviceId: svc.id,
        durationMins: 60,
        deliveryType: "IN_PERSON",
        label: "60 min",
        labelAr: "60 دقيقة",
        price: 30_000,
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
    });
    ids.durationOptionId = dur.id;

    await prisma.employeeService.create({
      data: { employeeId: emp.id, serviceId: svc.id, isActive: true },
    });
    await prisma.employeeBranch.create({
      data: { employeeId: emp.id, branchId: branch.id },
    });

    const businessHours = [];
    const empAvail = [];
    for (let dow = 0; dow < 7; dow++) {
      businessHours.push({
        branchId: branch.id,
        dayOfWeek: dow,
        startTime: "08:00",
        endTime: "22:00",
        isOpen: true,
      });
      empAvail.push({
        employeeId: emp.id,
        dayOfWeek: dow,
        startTime: "08:00",
        endTime: "22:00",
        isActive: true,
      });
    }
    await prisma.businessHour.createMany({ data: businessHours });
    await prisma.employeeAvailability.createMany({ data: empAvail });

    const cli = await prisma.client.create({
      data: {
        name: tag("client"),
        phone: `05${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: `reserve-consume-${suffix}-client@sawaa.test`,
        source: "ONLINE",
      },
    });
    ids.clientId = cli.id;
  }

  /** Seed a fresh SessionPackage + ACTIVE PackagePurchase + PackageCredit for
   *  the shared test client, with the given total session count. Each
   *  scenario gets its own bundle so cases cannot interfere with each
   *  other's counters. */
  async function seedCreditBundle(totalQuantity: number) {
    const pkg = await prisma.sessionPackage.create({
      data: {
        nameAr: tag("pack"),
        nameEn: tag("pack-en"),
        discountType: "FIXED",
        discountValue: 0,
        isPublic: false,
        isActive: true,
        sortOrder: 1,
        items: {
          create: [
            {
              serviceId: ids.serviceId,
              employeeId: ids.employeeId,
              durationOptionId: ids.durationOptionId,
              paidQuantity: totalQuantity,
              freeQuantity: 0,
              sortOrder: 1,
            },
          ],
        },
      },
    });
    packageIds.push(pkg.id);

    const purchase = await prisma.packagePurchase.create({
      data: {
        clientId: ids.clientId,
        packageId: pkg.id,
        status: "ACTIVE",
        subtotalSnapshot: 30_000 * totalQuantity,
        discountSnapshot: 0,
        amountPaid: 30_000 * totalQuantity,
        paidAt: new Date(),
        branchId: ids.branchId,
      },
    });
    purchaseIds.push(purchase.id);

    const credit = await prisma.packageCredit.create({
      data: {
        purchaseId: purchase.id,
        serviceId: ids.serviceId,
        employeeId: ids.employeeId,
        durationOptionId: ids.durationOptionId,
        totalQuantity,
        usedQuantity: 0,
        unitPriceSnapshot: 30_000,
      },
    });
    creditIds.push(credit.id);

    return { pkg, purchase, credit };
  }

  async function bookFromCredit(creditId: string, scheduledAt: Date) {
    const booking = await bookHandler.execute({
      clientId: ids.clientId,
      creditId,
      branchId: ids.branchId,
      scheduledAt,
      userId: ids.adminUserId,
    });
    bookingIds.push(booking.id);
    return booking;
  }

  function getCredit(creditId: string) {
    return prisma.packageCredit.findUniqueOrThrow({ where: { id: creditId } });
  }

  function getUsage(bookingId: string) {
    return prisma.packageCreditUsage.findFirstOrThrow({ where: { bookingId } });
  }

  function getPurchase(purchaseId: string) {
    return prisma.packagePurchase.findUniqueOrThrow({ where: { id: purchaseId } });
  }

  async function cleanup() {
    if (!prisma) return;
    const safe = (fn: () => Promise<unknown>) => fn().catch(() => undefined);

    await safe(() =>
      prisma.packageCreditUsage.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    );
    await safe(() =>
      prisma.bookingStatusLog.deleteMany({ where: { bookingId: { in: bookingIds } } }),
    );
    await safe(() =>
      prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }),
    );
    await safe(() =>
      prisma.packageCredit.deleteMany({ where: { id: { in: creditIds } } }),
    );
    await safe(() =>
      prisma.packagePurchase.deleteMany({ where: { id: { in: purchaseIds } } }),
    );
    await safe(() =>
      prisma.sessionPackage.deleteMany({ where: { id: { in: packageIds } } }),
    );
    await safe(() =>
      prisma.employeeAvailability.deleteMany({ where: { employeeId: ids.employeeId } }),
    );
    await safe(() =>
      prisma.businessHour.deleteMany({ where: { branchId: ids.branchId } }),
    );
    await safe(() =>
      prisma.employeeService.deleteMany({ where: { employeeId: ids.employeeId } }),
    );
    await safe(() =>
      prisma.employeeBranch.deleteMany({ where: { employeeId: ids.employeeId } }),
    );
    await safe(() =>
      prisma.serviceDurationOption.deleteMany({ where: { id: ids.durationOptionId } }),
    );
    await safe(() =>
      prisma.serviceBookingConfig.deleteMany({ where: { serviceId: ids.serviceId } }),
    );
    await safe(() =>
      prisma.client.deleteMany({ where: { id: ids.clientId } }),
    );
    await safe(() =>
      prisma.service.deleteMany({ where: { id: ids.serviceId } }),
    );
    await safe(() =>
      prisma.serviceCategory.deleteMany({ where: { nameEn: { startsWith: tag("") } } }),
    );
    await safe(() =>
      prisma.department.deleteMany({ where: { nameEn: { startsWith: tag("") } } }),
    );
    await safe(() =>
      prisma.employee.deleteMany({ where: { id: ids.employeeId } }),
    );
    await safe(() =>
      prisma.branch.deleteMany({ where: { nameEn: { startsWith: tag("") } } }),
    );
    await safe(() =>
      prisma.user.deleteMany({ where: { id: ids.adminUserId } }),
    );
  }

  function pauseRead(delegateName: string, methodName: string) {
    let resume!: () => void;
    let signal!: () => void;
    const hit = new Promise<void>((resolve) => (signal = resolve));
    const gate = new Promise<void>((resolve) => (resume = resolve));
    const rls = app.get(RlsTransactionService);
    const wrapped = {
      withTransaction: (fn: any) =>
        rls.withTransaction(async (tx: any) => {
          const proxy = new Proxy(tx, {
            get(target, prop) {
              if (prop !== delegateName) return target[prop];
              return new Proxy(target[prop], {
                get(delegate, method) {
                  if (method !== methodName) return delegate[method];
                  return async (args: any) => {
                    const result = await delegate[method](args);
                    signal();
                    await gate;
                    return result;
                  };
                },
              });
            },
          });
          return fn(proxy);
        }, { timeout: 20_000 }),
    };
    return {
      handler: new CheckInBookingHandler(prisma, wrapped as any),
      hit,
      resume,
    };
  }

  async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out`)), 10_000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  it("keeps a full refund terminal when check-in read RESERVED usage first", async () => {
    const { credit, purchase } = await seedCreditBundle(1);
    const booking = await bookFromCredit(credit.id, nextSlot());
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        scheduledAt: new Date(Date.now() - 7_200_000),
        endsAt: new Date(Date.now() - 3_600_000),
      },
    });
    const paused = pauseRead("packageCreditUsage", "findFirst");
    const checkInPending = paused.handler.execute({
      bookingId: booking.id,
      changedBy: ids.adminUserId,
    });
    let refundPending: Promise<unknown> | undefined;
    try {
      await bounded(paused.hit, "check-in read barrier");
      // Start the competing purchase lock while check-in is paused, then
      // let the refund complete while the stale check-in read is paused.
      // Refund only reads Booking rows, so it does not invert the booking /
      // purchase lock order. The check-in transaction is released only after
      // the purchase is terminal.
      refundPending = app.get(RefundPackagePurchaseHandler).execute({
        purchaseId: purchase.id,
        refundAmount: 30_000,
        userId: ids.adminUserId,
      });
      await bounded(refundPending, "refund before stale consume resumes");
      paused.resume();
      const [checkInOutcome, refundOutcome] = await bounded(
        Promise.allSettled([checkInPending, refundPending]),
        "refund/check-in race",
      );
      expect(checkInOutcome.status).toBe("fulfilled");
      expect(refundOutcome.status).toBe("fulfilled");
      expect((await getPurchase(purchase.id)).status).toBe("REFUNDED");
    } finally {
      paused.resume();
      await bounded(
        Promise.allSettled(refundPending ? [checkInPending, refundPending] : [checkInPending]),
        "refund/check-in cleanup",
      );
    }
    const actual = await getCredit(credit.id);
    expect({
      used: actual.usedQuantity,
      reserved: actual.reservedQuantity,
      purchase: (await getPurchase(purchase.id)).status,
      usage: (await getUsage(booking.id)).status,
    }).toEqual({
      used: 1,
      reserved: 0,
      purchase: "REFUNDED",
      usage: "RETURNED",
    });
  });

  it("keeps a sibling cancellation and final consumption consistent", async () => {
    const { credit, purchase } = await seedCreditBundle(1);
    const other = await prisma.packageCredit.create({
      data: {
        purchaseId: purchase.id,
        serviceId: ids.serviceId,
        employeeId: ids.employeeId,
        durationOptionId: ids.durationOptionId,
        totalQuantity: 1,
        usedQuantity: 0,
        unitPriceSnapshot: 30_000,
      },
    });
    creditIds.push(other.id);
    const bookingA = await bookFromCredit(credit.id, nextSlot());
    const bookingB = await bookFromCredit(other.id, nextSlot());
    await checkInHandler.execute({ bookingId: bookingB.id, changedBy: ids.adminUserId });
    const paused = pauseRead("packageCredit", "findMany");
    const consumePending = paused.handler.execute({ bookingId: bookingA.id, changedBy: ids.adminUserId });
    let cancelPending: Promise<unknown> | undefined;
    let cancelSpy: jest.SpyInstance | undefined;
    try {
      await bounded(paused.hit, "final-consume sibling read barrier");
      // Cancellation contends for the purchase row held by check-in. Release
      // the parent-lock holder only after observing cancellation's actual
      // SELECT ... FOR UPDATE attempt. The barrier never waits for the
      // blocked query to finish while the parent lock is held.
      let signalPurchaseLockAttempt!: () => void;
      const purchaseLockAttempt = new Promise<void>((resolve) => {
        signalPurchaseLockAttempt = resolve;
      });
      const rls = app.get(RlsTransactionService);
      const originalWithTransaction = rls.withTransaction.bind(rls);
      cancelSpy = jest.spyOn(rls, "withTransaction").mockImplementationOnce((fn: any, options?: any) =>
        originalWithTransaction(async (tx: any) => {
          const observedTx = new Proxy(tx, {
            get(target, prop) {
              if (prop !== "$queryRaw") return target[prop];
              return (...args: any[]) => {
                const [parts] = args;
                const sql = Array.isArray(parts) ? parts.join(" ") : "";
                if (sql.includes('"PackagePurchase"') && sql.includes("FOR UPDATE")) {
                  signalPurchaseLockAttempt();
                }
                return target.$queryRaw(...args);
              };
            },
          });
          return fn(observedTx);
        }, options),
      );
      cancelPending = cancelHandler.execute({
        bookingId: bookingB.id,
        changedBy: ids.adminUserId,
        reason: CancellationReason.CLIENT_REQUESTED,
        source: "admin",
      });
      await bounded(purchaseLockAttempt, "sibling cancellation purchase-lock attempt");
      paused.resume();
      const [consumeOutcome, cancelOutcome] = await bounded(
        Promise.allSettled([consumePending, cancelPending]),
        "sibling consume/cancel race",
      );
      expect(consumeOutcome.status).toBe("fulfilled");
      expect(cancelOutcome.status).toBe("fulfilled");
    } finally {
      paused.resume();
      try {
        await bounded(
          Promise.allSettled(cancelPending ? [consumePending, cancelPending] : [consumePending]),
          "sibling consume/cancel cleanup",
        );
      } finally {
        cancelSpy?.mockRestore();
      }
    }
    expect((await getUsage(bookingA.id)).status).toBe("CONSUMED");
    expect((await getUsage(bookingB.id)).status).toBe("RETURNED");
    expect((await getCredit(other.id)).usedQuantity).toBe(0);
    expect((await getPurchase(purchase.id)).status).toBe("ACTIVE");

    const rebooked = await bookFromCredit(other.id, nextSlot());
    expect((await getUsage(rebooked.id)).status).toBe("RESERVED");
    expect((await getCredit(other.id)).reservedQuantity).toBe(1);
  });

  it("completes two final consumes under one purchase without overwriting the terminal state", async () => {
    const { credit, purchase } = await seedCreditBundle(1);
    const other = await prisma.packageCredit.create({
      data: {
        purchaseId: purchase.id,
        serviceId: ids.serviceId,
        employeeId: ids.employeeId,
        durationOptionId: ids.durationOptionId,
        totalQuantity: 1,
        usedQuantity: 0,
        unitPriceSnapshot: 30_000,
      },
    });
    creditIds.push(other.id);
    const bookingA = await bookFromCredit(credit.id, nextSlot());
    const bookingB = await bookFromCredit(other.id, nextSlot());
    const paused = pauseRead("packageCreditUsage", "findFirst");
    const consumeA = paused.handler.execute({ bookingId: bookingA.id, changedBy: ids.adminUserId });
    let consumeB: Promise<unknown> | undefined;
    try {
      await bounded(paused.hit, "simultaneous final-consume read barrier");
      consumeB = checkInHandler.execute({
        bookingId: bookingB.id,
        changedBy: ids.adminUserId,
      });
      paused.resume();
      const outcomes = await bounded(
        Promise.allSettled([consumeA, consumeB]),
        "simultaneous final-consume race",
      );
      expect(outcomes[0].status).toBe("fulfilled");
      expect(outcomes[1].status).toBe("fulfilled");
    } finally {
      paused.resume();
      if (consumeB) {
        await bounded(Promise.allSettled([consumeA, consumeB]), "final-consume cleanup");
      } else {
        await bounded(Promise.allSettled([consumeA]), "final-consume cleanup");
      }
    }

    expect((await getCredit(credit.id)).usedQuantity).toBe(1);
    expect((await getCredit(other.id)).usedQuantity).toBe(1);
    expect((await getPurchase(purchase.id)).status).toBe("COMPLETED");
    expect((await getUsage(bookingA.id)).status).toBe("CONSUMED");
    expect((await getUsage(bookingB.id)).status).toBe("CONSUMED");
  });
});
