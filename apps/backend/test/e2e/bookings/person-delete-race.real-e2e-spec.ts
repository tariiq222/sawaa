import { randomUUID } from "node:crypto";
import { ConflictException, INestApplication, NotFoundException } from "@nestjs/common";
import { BookingStatus } from "@prisma/client";
import { createRealE2eApp } from "../../helpers/create-real-e2e-app";
import { PrismaService } from "../../../src/infrastructure/database";
import { CreateBookingHandler } from "../../../src/modules/bookings/create-booking/create-booking.handler";
import { BookFromCreditHandler } from "../../../src/modules/bookings/book-from-credit/book-from-credit.handler";
import { RestoreNoShowBookingHandler } from "../../../src/modules/bookings/restore-no-show-booking/restore-no-show-booking.handler";
import { CreateProgramHandler } from "../../../src/modules/bookings/create-program/create-program.handler";
import { UpdateProgramHandler } from "../../../src/modules/bookings/update-program/update-program.handler";
import { EnrollInProgramHandler } from "../../../src/modules/bookings/enroll-in-program/enroll-in-program.handler";
import { DeleteClientHandler } from "../../../src/modules/people/clients/delete-client.handler";
import { DeleteEmployeeHandler } from "../../../src/modules/people/employees/delete-employee.handler";
import { ACTIVE_BOOKING_STATUSES } from "../../../src/modules/bookings/active-booking-statuses";
import { hashToInt32 } from "../../../src/modules/bookings/booking-lifecycle.helper";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

type PersonFixture = { clientId: string; employeeId: string };
type TableName = "Client" | "Employee" | "Booking" | "Program" | "ProgramSupervisor";

describeRealE2e("Person deletion and reference-writer races (real e2e)", () => {
  jest.setTimeout(120_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let createBooking: CreateBookingHandler;
  let bookFromCredit: BookFromCreditHandler;
  let restoreNoShow: RestoreNoShowBookingHandler;
  let createProgram: CreateProgramHandler;
  let updateProgram: UpdateProgramHandler;
  let enrollInProgram: EnrollInProgramHandler;
  let deleteClient: DeleteClientHandler;
  let deleteEmployee: DeleteEmployeeHandler;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `person-race-${suffix}-${label}`;
  const ids = {
    branchId: "",
    departmentId: "",
    categoryId: "",
    serviceId: "",
    durationOptionId: "",
    bookingSettingsId: "",
  };
  const clientIds = new Set<string>();
  const employeeIds = new Set<string>();
  const bookingIds = new Set<string>();
  const programIds = new Set<string>();
  const purchaseIds = new Set<string>();
  const creditIds = new Set<string>();
  let slotSequence = 0;

  beforeAll(async () => {
    const testApp = await createRealE2eApp();
    app = testApp.app;
    prisma = testApp.prisma;
    createBooking = app.get(CreateBookingHandler);
    bookFromCredit = app.get(BookFromCreditHandler);
    restoreNoShow = app.get(RestoreNoShowBookingHandler);
    createProgram = app.get(CreateProgramHandler);
    updateProgram = app.get(UpdateProgramHandler);
    enrollInProgram = app.get(EnrollInProgramHandler);
    deleteClient = app.get(DeleteClientHandler);
    deleteEmployee = app.get(DeleteEmployeeHandler);
    await seedCatalog();
  });

  afterAll(async () => {
    await cleanup().catch(() => undefined);
    if (app) await app.close();
  });

  it("blocks Client and Employee deletion for every active booking status even when its invoice is PAID", async () => {
    const people = await createPeople("all-active");

    for (const status of ACTIVE_BOOKING_STATUSES) {
      const booking = await createRawBooking(people, status);
      await prisma.invoice.create({
        data: {
          branchId: ids.branchId,
          clientId: people.clientId,
          employeeId: people.employeeId,
          bookingId: booking.id,
          subtotal: 0,
          discountAmt: 0,
          vatRate: 0,
          vatAmt: 0,
          total: 0,
          status: "PAID",
          paidAt: new Date(),
        },
      });

      await expect(
        deleteClient.execute({ clientId: people.clientId }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        deleteEmployee.execute({ employeeId: people.employeeId }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(
        await prisma.client.count({
          where: { id: people.clientId, deletedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.employee.count({ where: { id: people.employeeId } }),
      ).toBe(1);
      await prisma.invoice.deleteMany({ where: { bookingId: booking.id } });
      await prisma.booking.delete({ where: { id: booking.id } });
    }
  });

  it("still soft-deletes an unreferenced Client and hard-deletes an unreferenced Employee", async () => {
    const people = await createPeople("unreferenced");

    await deleteClient.execute({ clientId: people.clientId });
    await deleteEmployee.execute({ employeeId: people.employeeId });

    const client = await prisma.client.findUnique({
      where: { id: people.clientId },
    });
    expect(client).toMatchObject({ isActive: false, phone: null });
    expect(client?.deletedAt).toBeInstanceOf(Date);
    expect(
      await prisma.employee.findUnique({ where: { id: people.employeeId } }),
    ).toBeNull();
  });

  it("writer wins: the actual CreateBooking handler commits before both person deletions recheck relationships", async () => {
    const people = await createPeople("create-writer-wins");
    const blocker = await holdBookingNumberLock();
    const writer = settle(createBooking.execute(bookingCommand(people)));
    await waitForAdvisoryWaiter(blocker.pid);

    const clientDeletion = settle(
      deleteClient.execute({ clientId: people.clientId }),
    );
    const employeeDeletion = settle(
      deleteEmployee.execute({ employeeId: people.employeeId }),
    );
    await waitForTransactionWaiters(blocker.pid, 2);
    await blocker.release();

    const writerResult = await writer;
    const clientResult = await clientDeletion;
    const employeeResult = await employeeDeletion;
    expect(writerResult.ok).toBe(true);
    expect(clientResult).toMatchObject({
      ok: false,
      error: expect.any(ConflictException),
    });
    expect(employeeResult).toMatchObject({
      ok: false,
      error: expect.any(ConflictException),
    });
    if (writerResult.ok)
      bookingIds.add((writerResult.value as { id: string }).id);
  });

  it.each(["Client", "Employee"] as const)(
    "delete wins for %s: actual CreateBooking rejects and cannot leave a dangling active booking",
    async (kind) => {
      const people = await createPeople(`create-delete-wins-${kind}`);
      const blocker = await holdTableShareLock(kind);
      const deletion =
        kind === "Client"
          ? settle(deleteClient.execute({ clientId: people.clientId }))
          : settle(deleteEmployee.execute({ employeeId: people.employeeId }));
      await waitForRelationWaiter(kind, blocker.pid);

      const writer = settle(createBooking.execute(bookingCommand(people)));
      await waitForTransactionWaiters(blocker.pid, 1);
      await blocker.release();

      expect((await deletion).ok).toBe(true);
      expect(await writer).toMatchObject({ ok: false, error: expect.any(NotFoundException) });
      expect(
        await prisma.booking.count({
          where:
            kind === "Client"
              ? {
                  clientId: people.clientId,
                  status: { in: [...ACTIVE_BOOKING_STATUSES] },
                }
              : {
                  employeeId: people.employeeId,
                  status: { in: [...ACTIVE_BOOKING_STATUSES] },
                },
        }),
      ).toBe(0);
    },
  );

  it("writer wins: actual no-show restore holds both people until CONFIRMED is durable", async () => {
    const people = await createPeople("restore-writer-wins");
    const booking = await createRawBooking(people, BookingStatus.NO_SHOW);
    const blocker = await holdTableShareLock("Booking");
    const writer = settle(
      restoreNoShow.execute({
        bookingId: booking.id,
        changedBy: randomUUID(),
        reason: "correct an automated no-show",
      }),
    );
    await waitForRelationWaiter("Booking", blocker.pid);

    const clientDeletion = settle(
      deleteClient.execute({ clientId: people.clientId }),
    );
    const employeeDeletion = settle(
      deleteEmployee.execute({ employeeId: people.employeeId }),
    );
    await waitForTransactionWaiters(blocker.pid, 2);
    await blocker.release();

    expect((await writer).ok).toBe(true);
    expect(await clientDeletion).toMatchObject({
      ok: false,
      error: expect.any(ConflictException),
    });
    expect(await employeeDeletion).toMatchObject({
      ok: false,
      error: expect.any(ConflictException),
    });
    expect(
      (await prisma.booking.findUnique({ where: { id: booking.id } }))?.status,
    ).toBe(BookingStatus.CONFIRMED);
  });

  it.each(["Client", "Employee"] as const)(
    "delete wins for %s: actual no-show restore rejects and leaves the booking NO_SHOW",
    async (kind) => {
      const people = await createPeople(`restore-delete-wins-${kind}`);
      const booking = await createRawBooking(people, BookingStatus.NO_SHOW);
      const blocker = await holdTableShareLock(kind);
      const deletion =
        kind === "Client"
          ? settle(deleteClient.execute({ clientId: people.clientId }))
          : settle(deleteEmployee.execute({ employeeId: people.employeeId }));
      await waitForRelationWaiter(kind, blocker.pid);

      const writer = settle(
        restoreNoShow.execute({
          bookingId: booking.id,
          changedBy: randomUUID(),
          reason: "attempt restore after person deletion starts",
        }),
      );
      await waitForTransactionWaiters(blocker.pid, 1);
      await blocker.release();

      expect((await deletion).ok).toBe(true);
      expect(await writer).toMatchObject({ ok: false, error: expect.any(NotFoundException) });
      expect(
        (await prisma.booking.findUnique({ where: { id: booking.id } }))
          ?.status,
      ).toBe(BookingStatus.NO_SHOW);
    },
  );

  it("program supervisor writer wins without deadlock, then Employee deletion sees the new guard", async () => {
    const people = await createPeople("program-writer-wins");
    const blocker = await holdTableShareLock("Program");
    const writer = settle(
      createProgram.execute(programCommand(people.employeeId, "writer-wins")),
    );
    await waitForRelationWaiter("Program", blocker.pid);

    const deletion = settle(
      deleteEmployee.execute({ employeeId: people.employeeId }),
    );
    await waitForTransactionWaiters(blocker.pid, 1);
    await blocker.release();

    const writerResult = await writer;
    expect(writerResult.ok).toBe(true);
    expect(await deletion).toMatchObject({
      ok: false,
      error: expect.any(ConflictException),
    });
    if (writerResult.ok)
      programIds.add((writerResult.value as { id: string }).id);
  });

  it("EnrollInProgram writer wins, then both person deletions observe its active booking", async () => {
    const people = await createPeople("enroll-writer-wins");
    const programId = await createProgramFixture(people.employeeId, "OPEN");
    const blocker = await holdProgramBookingNumberLock();
    const writer = settle(enrollInProgram.execute({ programId, clientId: people.clientId }));
    await waitForAdvisoryWaiter(blocker.pid);
    const clientDeletion = settle(deleteClient.execute({ clientId: people.clientId }));
    const employeeDeletion = settle(deleteEmployee.execute({ employeeId: people.employeeId }));
    await waitForTransactionWaiters(blocker.pid, 2);
    await blocker.release();
    const result = await writer;
    expect(result.ok).toBe(true);
    expect(await clientDeletion).toMatchObject({ ok: false, error: expect.any(ConflictException) });
    expect(await employeeDeletion).toMatchObject({ ok: false, error: expect.any(ConflictException) });
    if (result.ok) bookingIds.add(result.value.bookingId);
  });

  it.each(["Client", "Employee"] as const)(
    "delete wins for %s: EnrollInProgram returns person NotFound and creates no enrollment",
    async (kind) => {
      const people = await createPeople(`enroll-delete-${kind}`);
      const programId = await createProgramFixture(people.employeeId, "OPEN");
      if (kind === "Employee") {
        const deletionResult = await settle(deleteEmployee.execute({ employeeId: people.employeeId }));
        expect(deletionResult).toMatchObject({ ok: false, error: expect.any(ConflictException) });
        const writerResult = await settle(enrollInProgram.execute({ programId, clientId: people.clientId }));
        expect(writerResult.ok).toBe(true);
        if (writerResult.ok) bookingIds.add(writerResult.value.bookingId);
        return;
      }
      const blocker = await holdTableShareLock(kind);
      const deletion = kind === "Client"
        ? settle(deleteClient.execute({ clientId: people.clientId }))
        : settle(deleteEmployee.execute({ employeeId: people.employeeId }));
      await waitForRelationWaiter(kind, blocker.pid);
      const writer = settle(enrollInProgram.execute({ programId, clientId: people.clientId }));
      await waitForTransactionWaiters(blocker.pid, 1);
      await blocker.release();
      const deletionResult = await deletion;
      const writerResult = await writer;
      expect(deletionResult.ok).toBe(true);
      expect(writerResult).toMatchObject({ ok: false, error: expect.any(NotFoundException) });
      expect(await prisma.programEnrollment.count({ where: { programId, clientId: people.clientId } })).toBe(0);
    },
  );

  it("group RestoreNoShow takes Program then people and blocks both deletions until restoration commits", async () => {
    const supervisor = await createPeople("group-supervisor");
    const people = await createPeople("group-restore-writer");
    const programId = await createProgramFixture(supervisor.employeeId, "SCHEDULED");
    const booking = await createRawBooking(people, BookingStatus.NO_SHOW, { programId, bookingType: "GROUP" });
    await prisma.programEnrollment.create({ data: { programId, clientId: people.clientId, bookingId: booking.id } });
    const blocker = await holdTableShareLock("Booking");
    const writer = settle(restoreNoShow.execute({ bookingId: booking.id, changedBy: randomUUID(), reason: "restore group seat" }));
    await waitForRelationWaiter("Booking", blocker.pid);
    const clientDeletion = settle(deleteClient.execute({ clientId: people.clientId }));
    const employeeDeletion = settle(deleteEmployee.execute({ employeeId: people.employeeId }));
    await waitForTransactionWaiters(blocker.pid, 2);
    await blocker.release();
    expect((await writer).ok).toBe(true);
    expect(await clientDeletion).toMatchObject({ ok: false, error: expect.any(ConflictException) });
    expect(await employeeDeletion).toMatchObject({ ok: false, error: expect.any(ConflictException) });
  });

  it.each(["Client", "Employee"] as const)(
    "delete wins for %s: group RestoreNoShow returns person NotFound and remains NO_SHOW",
    async (kind) => {
      const supervisor = await createPeople(`group-delete-supervisor-${kind}`);
      const people = await createPeople(`group-delete-${kind}`);
      const programId = await createProgramFixture(supervisor.employeeId, "SCHEDULED");
      const booking = await createRawBooking(people, BookingStatus.NO_SHOW, { programId, bookingType: "GROUP" });
      await prisma.programEnrollment.create({ data: { programId, clientId: people.clientId, bookingId: booking.id } });
      const blocker = await holdTableShareLock(kind);
      const deletion = kind === "Client" ? settle(deleteClient.execute({ clientId: people.clientId })) : settle(deleteEmployee.execute({ employeeId: people.employeeId }));
      await waitForRelationWaiter(kind, blocker.pid);
      const writer = settle(restoreNoShow.execute({ bookingId: booking.id, changedBy: randomUUID(), reason: "deleted group person" }));
      await waitForTransactionWaiters(blocker.pid, 1);
      await blocker.release();
      expect((await deletion).ok).toBe(true);
      expect(await writer).toMatchObject({ ok: false, error: expect.any(NotFoundException) });
      expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe(BookingStatus.NO_SHOW);
    },
  );

  it("UpdateProgram supervisor replacement wins, then Employee deletion sees the supervisor guard", async () => {
    const old = await createPeople("update-old");
    const next = await createPeople("update-next");
    const programId = await createProgramFixture(old.employeeId, "DRAFT");
    const blocker = await holdTableShareLock("ProgramSupervisor");
    const writer = settle(updateProgram.execute(programId, { supervisorIds: [next.employeeId] }));
    await waitForRelationWaiter("ProgramSupervisor", blocker.pid);
    const deletion = settle(deleteEmployee.execute({ employeeId: next.employeeId }));
    await waitForTransactionWaiters(blocker.pid, 1);
    await blocker.release();
    expect((await writer).ok).toBe(true);
    expect(await deletion).toMatchObject({ ok: false, error: expect.any(ConflictException) });
    expect(await prisma.programSupervisor.count({ where: { programId, employeeId: next.employeeId } })).toBe(1);
  });

  it("Employee deletion wins and UpdateProgram supervisor replacement returns NotFound", async () => {
    const old = await createPeople("update-delete-old");
    const next = await createPeople("update-delete-next");
    const programId = await createProgramFixture(old.employeeId, "DRAFT");
    const blocker = await holdTableShareLock("Employee");
    const deletion = settle(deleteEmployee.execute({ employeeId: next.employeeId }));
    await waitForRelationWaiter("Employee", blocker.pid);
    const writer = settle(updateProgram.execute(programId, { supervisorIds: [next.employeeId] }));
    await waitForTransactionWaiters(blocker.pid, 1);
    await blocker.release();
    expect((await deletion).ok).toBe(true);
    expect(await writer).toMatchObject({ ok: false, error: expect.any(NotFoundException) });
    expect(await prisma.programSupervisor.count({ where: { programId, employeeId: next.employeeId } })).toBe(0);
  });

  it("Employee deletion wins without deadlock and the actual program supervisor writer rejects", async () => {
    const people = await createPeople("program-delete-wins");
    const blocker = await holdTableShareLock("Employee");
    const deletion = settle(
      deleteEmployee.execute({ employeeId: people.employeeId }),
    );
    await waitForRelationWaiter("Employee", blocker.pid);

    const writer = settle(
      createProgram.execute(programCommand(people.employeeId, "delete-wins")),
    );
    await waitForTransactionWaiters(blocker.pid, 1);
    await blocker.release();

    expect((await deletion).ok).toBe(true);
    expect(await writer).toMatchObject({ ok: false, error: expect.any(NotFoundException) });
    expect(
      await prisma.programSupervisor.count({
        where: { employeeId: people.employeeId },
      }),
    ).toBe(0);
  });

  it("credit writer locks people before credit and booking-number work, then both deletions observe its booking", async () => {
    const people = await createPeople("credit-writer-wins");
    const creditId = await createCredit(people);
    const blocker = await holdBookingNumberLock();
    const writer = settle(
      bookFromCredit.execute({
        clientId: people.clientId,
        creditId,
        branchId: ids.branchId,
        scheduledAt: nextSlot(),
        userId: randomUUID(),
      }),
    );
    await waitForAdvisoryWaiter(blocker.pid);

    const clientDeletion = settle(
      deleteClient.execute({ clientId: people.clientId }),
    );
    const employeeDeletion = settle(
      deleteEmployee.execute({ employeeId: people.employeeId }),
    );
    await waitForTransactionWaiters(blocker.pid, 2);
    await blocker.release();

    const writerResult = await writer;
    expect(writerResult.ok).toBe(true);
    expect(await clientDeletion).toMatchObject({
      ok: false,
      error: expect.any(ConflictException),
    });
    expect(await employeeDeletion).toMatchObject({
      ok: false,
      error: expect.any(ConflictException),
    });
    if (writerResult.ok)
      bookingIds.add((writerResult.value as { id: string }).id);
  });

  it.each(["Client", "Employee"] as const)(
    "delete wins for %s: BookFromCredit returns person NotFound and leaves credit unused",
    async (kind) => {
      const people = await createPeople(`credit-delete-wins-${kind}`);
      const creditId = await createCredit(people);
      const blocker = await holdTableShareLock(kind);
      const deletion = kind === "Client"
        ? settle(deleteClient.execute({ clientId: people.clientId }))
        : settle(deleteEmployee.execute({ employeeId: people.employeeId }));
      await waitForRelationWaiter(kind, blocker.pid);
      const writer = settle(bookFromCredit.execute({
        clientId: people.clientId,
        creditId,
        branchId: ids.branchId,
        scheduledAt: nextSlot(),
        userId: randomUUID(),
      }));
      await waitForTransactionWaiters(blocker.pid, 1);
      await blocker.release();

      expect((await deletion).ok).toBe(true);
      expect(await writer).toMatchObject({ ok: false, error: expect.any(NotFoundException) });
      expect((await prisma.packageCredit.findUnique({ where: { id: creditId } }))?.usedQuantity).toBe(0);
    },
  );

  async function seedCatalog(): Promise<void> {
    const branch = await prisma.branch.create({
      data: { nameAr: tag("branch"), nameEn: tag("branch-en"), isActive: true },
    });
    ids.branchId = branch.id;
    const department = await prisma.department.create({
      data: {
        nameAr: tag("department"),
        nameEn: tag("department-en"),
        isActive: true,
      },
    });
    ids.departmentId = department.id;
    const category = await prisma.serviceCategory.create({
      data: {
        nameAr: tag("category"),
        nameEn: tag("category-en"),
        departmentId: department.id,
        isActive: true,
      },
    });
    ids.categoryId = category.id;
    const service = await prisma.service.create({
      data: {
        nameAr: tag("service"),
        nameEn: tag("service-en"),
        durationMins: 60,
        price: 0,
        currency: "SAR",
        isActive: true,
        categoryId: category.id,
      },
    });
    ids.serviceId = service.id;
    await prisma.serviceBookingConfig.create({
      data: {
        serviceId: service.id,
        deliveryType: "IN_PERSON",
        durationMins: 60,
        isActive: true,
      },
    });
    const duration = await prisma.serviceDurationOption.create({
      data: {
        serviceId: service.id,
        deliveryType: "IN_PERSON",
        label: "60 min",
        labelAr: "60 دقيقة",
        durationMins: 60,
        price: 0,
        currency: "SAR",
        isDefault: true,
        isActive: true,
      },
    });
    ids.durationOptionId = duration.id;
    const settings = await prisma.bookingSettings.create({
      data: {
        branchId: branch.id,
        minBookingLeadMinutes: 0,
        maxAdvanceBookingDays: 90,
        bufferMinutes: 0,
      },
    });
    ids.bookingSettingsId = settings.id;
    await prisma.businessHour.createMany({
      data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        branchId: branch.id,
        dayOfWeek,
        startTime: "00:00",
        endTime: "23:59",
        isOpen: true,
      })),
    });
  }

  async function createPeople(label: string): Promise<PersonFixture> {
    const client = await prisma.client.create({
      data: {
        name: tag(`${label}-client`),
        email: `${tag(`${label}-${randomUUID()}`)}@sawaa.test`,
        phone: null,
        source: "ONLINE",
        isActive: true,
      },
    });
    clientIds.add(client.id);
    const employee = await prisma.employee.create({
      data: {
        name: tag(`${label}-employee`),
        email: `${tag(`${label}-${randomUUID()}`)}@sawaa.test`,
        isActive: true,
      },
    });
    employeeIds.add(employee.id);
    await prisma.employeeService.create({
      data: {
        employeeId: employee.id,
        serviceId: ids.serviceId,
        isActive: true,
      },
    });
    await prisma.employeeBranch.create({
      data: { employeeId: employee.id, branchId: ids.branchId },
    });
    await prisma.employeeAvailability.createMany({
      data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        employeeId: employee.id,
        dayOfWeek,
        startTime: "00:00",
        endTime: "23:59",
        isActive: true,
      })),
    });
    return { clientId: client.id, employeeId: employee.id };
  }

  function nextSlot(): Date {
    slotSequence += 1;
    const value = new Date();
    value.setDate(value.getDate() + 10 + slotSequence);
    value.setHours(10, 0, 0, 0);
    return value;
  }

  function bookingCommand(people: PersonFixture) {
    return {
      branchId: ids.branchId,
      clientId: people.clientId,
      employeeId: people.employeeId,
      serviceId: ids.serviceId,
      durationOptionId: ids.durationOptionId,
      scheduledAt: nextSlot(),
      bookingType: "INDIVIDUAL",
      deliveryType: "IN_PERSON",
      source: "RECEPTION" as const,
    };
  }

  async function createRawBooking(
    people: PersonFixture,
    status: BookingStatus,
    options: { programId?: string; bookingType?: "INDIVIDUAL" | "GROUP" } = {},
  ) {
    const booking = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32("booking_number")}::int, 0::int)`;
      const last = await tx.booking.findFirst({
        orderBy: { bookingNumber: "desc" },
        select: { bookingNumber: true },
      });
      const scheduledAt = nextSlot();
      return tx.booking.create({
        data: {
          branchId: ids.branchId,
          clientId: people.clientId,
          employeeId: people.employeeId,
          serviceId: ids.serviceId,
          durationOptionId: ids.durationOptionId,
          scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 60 * 60_000),
          durationMins: 60,
          price: 0,
          currency: "SAR",
          bookingType: options.bookingType ?? "INDIVIDUAL",
          programId: options.programId,
          deliveryType: "IN_PERSON",
          source: "RECEPTION",
          status,
          bookingNumber: (last?.bookingNumber ?? 0) + 1,
        },
      });
    });
    bookingIds.add(booking.id);
    return booking;
  }

  function programCommand(employeeId: string, label: string) {
    return {
      departmentId: ids.departmentId,
      branchId: ids.branchId,
      nameAr: tag(`program-${label}`),
      daysCount: 1,
      hoursPerDay: 1,
      minParticipants: 1,
      maxParticipants: 2,
      price: 0,
      supervisorIds: [employeeId],
      createdBy: randomUUID(),
    };
  }

  async function createProgramFixture(employeeId: string, status: "DRAFT" | "OPEN" | "SCHEDULED") {
    const program = await createProgram.execute(programCommand(employeeId, `fixture-${status}`));
    programIds.add(program.id);
    if (status !== "DRAFT") {
      await prisma.program.update({ where: { id: program.id }, data: { status } });
    }
    return program.id;
  }

  async function createCredit(people: PersonFixture): Promise<string> {
    const purchase = await prisma.packagePurchase.create({
      data: {
        packageId: randomUUID(),
        clientId: people.clientId,
        branchId: ids.branchId,
        status: "ACTIVE",
        subtotalSnapshot: 0,
        discountSnapshot: 0,
        amountPaid: 0,
        paidAt: new Date(),
      },
    });
    purchaseIds.add(purchase.id);
    const credit = await prisma.packageCredit.create({
      data: {
        purchaseId: purchase.id,
        serviceId: ids.serviceId,
        employeeId: people.employeeId,
        durationOptionId: ids.durationOptionId,
        unitPriceSnapshot: 0,
        totalQuantity: 1,
        usedQuantity: 0,
      },
    });
    creditIds.add(credit.id);
    return credit.id;
  }

  async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
    try {
      return { ok: true, value: await promise };
    } catch (error) {
      return { ok: false, error };
    }
  }

  async function holdTableShareLock(table: TableName) {
    let ready!: () => void;
    let release!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    let pid = 0;
    const done = prisma.$transaction(
      async (tx) => {
        [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
        if (table === "Client")
          await tx.$executeRaw`LOCK TABLE "Client" IN SHARE MODE`;
        else if (table === "Employee")
          await tx.$executeRaw`LOCK TABLE "Employee" IN SHARE MODE`;
        else if (table === "Booking")
          await tx.$executeRaw`LOCK TABLE "Booking" IN SHARE MODE`;
        else if (table === "Program") await tx.$executeRaw`LOCK TABLE "Program" IN SHARE MODE`;
        else await tx.$executeRaw`LOCK TABLE "ProgramSupervisor" IN SHARE MODE`;
        ready();
        await releasePromise;
      },
      { timeout: 30_000 },
    );
    await readyPromise;
    return {
      pid,
      release: async () => {
        release();
        await done;
      },
    };
  }

  async function holdBookingNumberLock() {
    let ready!: () => void;
    let release!: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    let pid = 0;
    const done = prisma.$transaction(
      async (tx) => {
        [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32("booking_number")}::int, 0::int)`;
        ready();
        await releasePromise;
      },
      { timeout: 30_000 },
    );
    await readyPromise;
    return {
      pid,
      release: async () => {
        release();
        await done;
      },
    };
  }

  async function holdProgramBookingNumberLock() {
    let ready!: () => void;
    let release!: () => void;
    let pid = 0;
    const readyPromise = new Promise<void>((resolve) => { ready = resolve; });
    const releasePromise = new Promise<void>((resolve) => { release = resolve; });
    const done = prisma.$transaction(async (tx) => {
      [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking_number'), 0)`;
      ready();
      await releasePromise;
    }, { timeout: 30_000 });
    await readyPromise;
    return { pid, release: async () => { release(); await done; } };
  }

  async function waitForRelationWaiter(table: TableName, blockerPid: number): Promise<void> {
    await waitUntil(async () => {
      const [row] = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count
        FROM pg_locks lock
        JOIN pg_class relation ON relation.oid = lock.relation
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname = ${table}
          AND lock.mode = 'RowExclusiveLock'
          AND lock.granted = false
          AND ${blockerPid} = ANY(pg_blocking_pids(lock.pid))
      `;
      return row.count >= 1;
    }, `a RowExclusiveLock waiter on ${table}`);
  }

  async function waitForAdvisoryWaiter(blockerPid: number): Promise<void> {
    await waitUntil(async () => {
      const [row] = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count
        FROM pg_locks
        WHERE locktype = 'advisory' AND granted = false
          AND ${blockerPid} = ANY(pg_blocking_pids(pid))
      `;
      return row.count >= 1;
    }, "an advisory-lock waiter");
  }

  async function waitForTransactionWaiters(blockerPid: number, minimum: number): Promise<void> {
    await waitUntil(async () => {
      const [row] = await prisma.$queryRaw<Array<{ count: number }>>`
        WITH RECURSIVE blocked(pid) AS (
          SELECT activity.pid
          FROM pg_stat_activity activity
          WHERE ${blockerPid} = ANY(pg_blocking_pids(activity.pid))
          UNION
          SELECT activity.pid
          FROM pg_stat_activity activity
          JOIN blocked parent
            ON parent.pid = ANY(pg_blocking_pids(activity.pid))
        )
        SELECT count(*)::int AS count
        FROM pg_locks lock
        JOIN blocked ON blocked.pid = lock.pid
        WHERE lock.locktype = 'transactionid' AND lock.granted = false
      `;
      return row.count >= minimum;
    }, `${minimum} transaction-lock waiter(s)`);
  }

  async function waitUntil(
    predicate: () => Promise<boolean>,
    label: string,
  ): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${label}`);
  }

  async function cleanup(): Promise<void> {
    if (!prisma) return;
    const bookings = [...bookingIds];
    const programs = [...programIds];
    const employees = [...employeeIds];
    const clients = [...clientIds];
    const purchases = [...purchaseIds];
    const credits = [...creditIds];
    await prisma.activityLog.deleteMany({
      where: { entityId: { in: credits } },
    });
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { in: bookings } },
    });
    await prisma.bookingStatusLog.deleteMany({
      where: { bookingId: { in: bookings } },
    });
    await prisma.packageCreditUsage.deleteMany({
      where: { bookingId: { in: bookings } },
    });
    await prisma.invoice.deleteMany({ where: { bookingId: { in: bookings } } });
    await prisma.programEnrollment.deleteMany({
      where: {
        OR: [{ bookingId: { in: bookings } }, { programId: { in: programs } }],
      },
    });
    await prisma.booking.deleteMany({ where: { id: { in: bookings } } });
    await prisma.program.deleteMany({ where: { id: { in: programs } } });
    await prisma.packageCredit.deleteMany({ where: { id: { in: credits } } });
    await prisma.packagePurchase.deleteMany({
      where: { id: { in: purchases } },
    });
    await prisma.employeeAvailability.deleteMany({
      where: { employeeId: { in: employees } },
    });
    await prisma.employeeBranch.deleteMany({
      where: { employeeId: { in: employees } },
    });
    await prisma.employeeService.deleteMany({
      where: { employeeId: { in: employees } },
    });
    await prisma.employee.deleteMany({ where: { id: { in: employees } } });
    await prisma.client.deleteMany({ where: { id: { in: clients } } });
    if (ids.bookingSettingsId) {
      await prisma.bookingSettings.deleteMany({
        where: { id: ids.bookingSettingsId },
      });
    }
    await prisma.businessHour.deleteMany({ where: { branchId: ids.branchId } });
    await prisma.serviceDurationOption.deleteMany({
      where: { id: ids.durationOptionId },
    });
    await prisma.serviceBookingConfig.deleteMany({
      where: { serviceId: ids.serviceId },
    });
    await prisma.service.deleteMany({ where: { id: ids.serviceId } });
    await prisma.serviceCategory.deleteMany({ where: { id: ids.categoryId } });
    await prisma.department.deleteMany({ where: { id: ids.departmentId } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
  }
});
