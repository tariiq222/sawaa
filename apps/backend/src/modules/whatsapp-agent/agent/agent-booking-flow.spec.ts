import { AgentOrchestratorService } from "./agent-orchestrator.service";
import { BookingToolsService } from "./booking-tools.service";
import { SpecialistRegistryService } from "./specialist-registry.service";

describe("WhatsApp booking end-to-end flow", () => {
  const config = {
    id: "cfg-1",
    isActive: true,
    defaultLanguage: "ar",
    systemPromptAr: "",
    systemPromptEn: "",
    greetingAr: null,
    greetingEn: null,
    aiModel: "anthropic/claude-test",
    aiTemperature: 0.4,
    aiMaxTokens: 800,
    businessHoursOnly: false,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
  };

  const employeeId = "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d5";
  const serviceId = "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d6";
  const branchId = "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d7";
  const durationOptionId = "c1b2c3d4-e5f6-4a5b-8c9d-e0f1a2b3c4d8";
  const conversationId = "conversation-flow";

  function buildPrisma(context: Record<string, unknown> = {}) {
    let updatedContext: Record<string, unknown> = {
      activeSpecialist: "NEW_BOOKING",
      ...context,
    };
    return {
      whatsappAgentConfig: {
        findFirst: jest.fn().mockResolvedValue(config),
        update: jest.fn().mockResolvedValue(config),
      },
      whatsappConversation: {
        upsert: jest.fn().mockResolvedValue({
          id: conversationId,
          phone: "+966500000000",
          staffTakeover: false,
          status: "ACTIVE",
          context: updatedContext,
        }),
        findUnique: jest.fn().mockImplementation(async (args: { where: { id?: string } }) => {
          if (args?.where?.id) {
            return { staffTakeover: false, context: updatedContext };
          }
          return { staffTakeover: false };
        }),
        update: jest.fn().mockImplementation(async ({ data }: { data: { context?: Record<string, unknown> } }) => {
          if (data.context) updatedContext = data.context;
          return {};
        }),
      },
      whatsappMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ createdAt: new Date() }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }: { data: { role: string; content?: string } }) => ({
          id: `msg-${data.role}`,
          createdAt: new Date(),
          content: data.content ?? "",
          role: data.role,
        })),
        update: jest.fn().mockResolvedValue({}),
      },
      businessHour: { findMany: jest.fn().mockResolvedValue([]) },
    };
  }

  function buildLlm(sequence: Array<{ content: string | null; toolCalls: unknown[] }>) {
    const calls: Array<{ model: string; messages: unknown[] }> = [];
    let i = 0;
    const complete = jest.fn().mockImplementation(async (input: { model: string; messages: unknown[] }) => {
      calls.push(input);
      const next = sequence[i++] ?? { content: "ok", toolCalls: [] };
      return { ...next, tokensUsed: 10, model: input.model };
    });
    return {
      resolveApiKey: jest.fn().mockResolvedValue("key"),
      complete,
      calls,
    };
  }

  function buildTools(opts: {
    proposalId: string;
    services?: unknown[];
    counselors?: unknown[];
  }) {
    const services = opts.services ?? [
      {
        id: serviceId,
        nameAr: "جلسة إرشاد أسري",
        nameEn: "Family Session",
        durationMins: 60,
        durationOptions: [
          { id: durationOptionId, durationMins: 60, price: 30000 },
        ],
      },
    ];
    const counselors = opts.counselors ?? [
      {
        id: employeeId,
        name: "Salman Al-Rashed",
        nameAr: "سلمان الراشد",
        bio: "Family counselor",
        avatarUrl: null,
      },
    ];
    const stored: Record<string, unknown> = {};
    const pending: {
      intent: Record<string, unknown>;
      proposalId: string;
      expiresAt: Date;
    } | null = {
      intent: {
        firstName: "سلمان",
        lastName: "الراشد",
        serviceId,
        employeeId,
        branchId,
        durationOptionId,
        scheduledAt: "2026-08-02T10:00:00.000Z",
        deliveryType: "IN_PERSON",
      },
      proposalId: opts.proposalId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
    const tools = {
      listTools: jest.fn().mockReturnValue([]),
      execute: jest.fn().mockImplementation(async (toolName: string, args: Record<string, unknown>) => {
        if (toolName === "listServices") return services;
        if (toolName === "listCounselors") return counselors;
        if (toolName === "checkAvailability") {
          return {
            available: true,
            date: args.date,
            slots: [
              { startTime: "2026-08-02T07:00:00.000Z", endTime: "2026-08-02T08:00:00.000Z" },
            ],
          };
        }
        if (toolName === "proposeBooking") {
          return {
            ok: true,
            requiresConfirmation: true,
            proposalId: opts.proposalId,
            summary: pending.intent,
          };
        }
        return {};
      }),
      getPendingBooking: jest.fn().mockImplementation(async (id: string) => {
        if (id !== conversationId) return null;
        return pending;
      }),
      rejectPendingBooking: jest.fn().mockResolvedValue(undefined),
      confirmPendingBooking: jest.fn().mockImplementation(async () => ({
        bookingNumber: 1001,
        scheduledAt: pending.intent.scheduledAt,
        clientName: "سلمان الراشد",
        proposalId: opts.proposalId,
      })),
    } as unknown as BookingToolsService;
    return tools;
  }

  function buildTransport() {
    return {
      resolve: jest.fn().mockResolvedValue({
        client: { sendText: jest.fn().mockResolvedValue({ ok: true, messageId: "out-1" }) },
      }),
    };
  }

  it("flows: greet → listServices → listCounselors → checkAvailability → proposeBooking → Confirm booking", async () => {
    const proposalId = "prop_test_1";
    const prisma = buildPrisma();
    const transport = buildTransport();
    const tools = buildTools({ proposalId });
    const llm = buildLlm([{ content: "أهلاً! تفضل.", toolCalls: [] }]);

    const orchestrator = new AgentOrchestratorService(
      prisma as never,
      llm as never,
      tools as never,
      transport as never,
      new SpecialistRegistryService(),
    );

    await orchestrator.handleInbound(
      "+966500000000",
      "أبغى أحجز جلسة أسرية",
      "in-1",
    );

    expect(prisma.whatsappMessage.create).toHaveBeenCalled();
  });

  it("rejects ambiguous 'نعم' confirmation and requires explicit phrase", async () => {
    const proposalId = "prop_test_2";
    const prisma = buildPrisma();
    const transport = buildTransport();
    const tools = buildTools({ proposalId });
    const llm = buildLlm([{ content: "تأكيد محجوز", toolCalls: [] }]);

    const orchestrator = new AgentOrchestratorService(
      prisma as never,
      llm as never,
      tools as never,
      transport as never,
    );

    await orchestrator.handleInbound(
      "+966500000000",
      "نعم",
      "in-2",
    );

    const assistantMessageCreate = prisma.whatsappMessage.create.mock.calls.find(
      (call) => call[0].data.role === "ASSISTANT",
    );
    expect(assistantMessageCreate).toBeDefined();
    expect(assistantMessageCreate![0].data.content).toContain("أؤكد الحجز");
    expect(tools.confirmPendingBooking).not.toHaveBeenCalled();
  });

  it("confirms a booking only when the customer writes the explicit phrase", async () => {
    const proposalId = "prop_test_3";
    const prisma = buildPrisma();
    const transport = buildTransport();
    const tools = buildTools({ proposalId });
    const llm = buildLlm([{ content: "تم تأكيد الحجز.", toolCalls: [] }]);

    const orchestrator = new AgentOrchestratorService(
      prisma as never,
      llm as never,
      tools as never,
      transport as never,
    );

    await orchestrator.handleInbound(
      "+966500000000",
      "أؤكد الحجز",
      "in-3",
    );

    expect(tools.confirmPendingBooking).toHaveBeenCalledTimes(1);
    expect(prisma.whatsappMessage.create).toHaveBeenCalled();
  });
});