import { BookingToolsService } from "./booking-tools.service";

describe("BookingToolsService", () => {
  it("lists public counselors without querying removed employee fields", async () => {
    const prisma = {
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "employee-1",
            name: "Ahood Al-Shalhoub",
            nameAr: "عهود الشلهوب",
            bio: "Family counselor",
            avatarUrl: null,
          },
        ]),
      },
    };
    const tools = new BookingToolsService(prisma as never, {} as never);

    const result = await tools.execute(
      "listCounselors",
      {},
      { phone: "+966500000000" },
    );

    expect(prisma.employee.findMany).toHaveBeenCalledWith({
      where: { isActive: true, isPublic: true },
      take: 30,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nameAr: true,
        bio: true,
        avatarUrl: true,
      },
    });
    expect(result).toEqual([
      {
        id: "employee-1",
        name: "Ahood Al-Shalhoub",
        nameAr: "عهود الشلهوب",
        bio: "Family counselor",
        avatarUrl: null,
      },
    ]);
  });

  it("filters counselors by serviceId through the active services relation", async () => {
    const prisma = {
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const tools = new BookingToolsService(
      prisma as never,
      { execute: jest.fn() } as never,
    );

    await tools.execute(
      "listCounselors",
      { serviceId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d6" },
      { phone: "+966500000000" },
    );

    expect(prisma.employee.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        isPublic: true,
        services: {
          some: {
            serviceId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d6",
            isActive: true,
          },
        },
      },
      take: 30,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nameAr: true,
        bio: true,
        avatarUrl: true,
      },
    });
  });

  it("returns exact slots from the public availability handler", async () => {
    const availability = {
      execute: jest.fn().mockResolvedValue([
        {
          startTime: new Date("2026-08-02T06:00:00.000Z"),
          endTime: new Date("2026-08-02T07:00:00.000Z"),
        },
      ]),
    };
    const tools = new BookingToolsService(
      { employee: { findMany: jest.fn() } } as never,
      availability as never,
    );

    const result = await tools.execute(
      "checkAvailability",
      {
        employeeId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5",
        date: "2026-08-02",
        serviceId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d6",
        branchId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d7",
        durationOptionId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d8",
        deliveryType: "ONLINE",
      },
      { phone: "+966500000000" },
    );

    expect(availability.execute).toHaveBeenCalledWith({
      employeeId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5",
      date: "2026-08-02",
      serviceId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d6",
      branchId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d7",
      durationOptionId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d8",
      deliveryType: "ONLINE",
    });
    expect(result).toEqual({
      available: true,
      date: "2026-08-02",
      slots: [
        {
          startTime: "2026-08-02T06:00:00.000Z",
          endTime: "2026-08-02T07:00:00.000Z",
        },
      ],
    });
  });

  it("rejects proposeBooking when serviceId or employeeId are missing or malformed", async () => {
    const prisma = {
      employee: { findMany: jest.fn() },
      whatsappConversation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const tools = new BookingToolsService(prisma as never, {} as never);

    const result = await tools.execute(
      "proposeBooking",
      {
        firstName: "سلمان",
        lastName: "الراشد",
        serviceId: "not-a-uuid",
        employeeId: "also-bad",
        scheduledAt: "2026-08-02T10:00:00.000Z",
        deliveryType: "IN_PERSON",
      },
      { phone: "+966500000000", conversationId: "conv-1" },
    );

    expect(result).toMatchObject({ tool: "proposeBooking" });
    expect(prisma.whatsappConversation.update).not.toHaveBeenCalled();
  });

  it("exposes an expiring proposalId with a 15-minute TTL", async () => {
    const before = Date.now();
    const prisma = {
      employee: { findMany: jest.fn() },
      whatsappConversation: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ context: { activeSpecialist: "NEW_BOOKING" } }),
        update: jest.fn().mockImplementation(async ({ data }: { data: { context: Record<string, unknown> } }) => data.context),
      },
    };
    const tools = new BookingToolsService(prisma as never, {} as never);

    const result = (await tools.execute(
      "proposeBooking",
      {
        firstName: "سلمان",
        lastName: "الراشد",
        serviceId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d6",
        employeeId: "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5",
        scheduledAt: "2026-08-02T10:00:00.000Z",
        deliveryType: "IN_PERSON",
      },
      { phone: "+966500000000", conversationId: "conv-1" },
    )) as { proposalId: string; ok: boolean };

    expect(result.ok).toBe(true);
    expect(result.proposalId).toMatch(/^prop_/);
    const stored = (prisma.whatsappConversation.update as jest.Mock).mock
      .calls[0][0].data.context as Record<string, unknown>;
    const expiresAt = new Date(stored.pendingProposalExpiresAt as string);
    expect(expiresAt.getTime()).toBeGreaterThan(before);
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(15 * 60 * 1000 - 5_000);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(15 * 60 * 1000 + 5_000);
  });

  it("returns null from getPendingBooking when the proposal has expired", async () => {
    const prisma = {
      whatsappConversation: {
        findUnique: jest.fn().mockResolvedValue({
          context: {
            pendingBooking: { firstName: "A" },
            pendingProposalId: "prop_old",
            pendingProposalExpiresAt: new Date(Date.now() - 1000).toISOString(),
          },
        }),
      },
    };
    const tools = new BookingToolsService(prisma as never, {} as never);

    const result = await tools.getPendingBooking("conv-1");
    expect(result).toBeNull();
  });
});
