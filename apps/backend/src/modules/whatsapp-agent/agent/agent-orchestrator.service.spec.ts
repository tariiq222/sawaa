import { AgentOrchestratorService } from "./agent-orchestrator.service";

const config = {
  id: "cfg-1",
  isActive: true,
  defaultLanguage: "ar",
  systemPromptAr: "system ar",
  systemPromptEn: "system en",
  greetingAr: null,
  greetingEn: null,
  aiModel: "anthropic/claude-sonnet-5",
  aiTemperature: 0.4,
  aiMaxTokens: 800,
  businessHoursOnly: false,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
};

function buildPrisma() {
  const userMessage = {
    id: "user-message-1",
    createdAt: new Date(),
    content: "hello",
    role: "USER",
  };
  return {
    whatsappAgentConfig: {
      findFirst: jest.fn().mockResolvedValue(config),
      update: jest.fn().mockResolvedValue(config),
    },
    whatsappConversation: {
      upsert: jest.fn().mockResolvedValue({
        id: "conversation-1",
        phone: "+966500000000",
        staffTakeover: false,
        status: "ACTIVE",
        context: null,
      }),
      findUnique: jest.fn().mockResolvedValue({ staffTakeover: false }),
      update: jest.fn().mockResolvedValue({}),
    },
    whatsappMessage: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation(async ({ data }: { data: { role: string } }) =>
          data.role === "USER"
            ? userMessage
            : { id: "assistant-message-1", createdAt: new Date(), ...data },
        ),
      update: jest.fn().mockResolvedValue({}),
    },
    businessHour: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe("AgentOrchestratorService", () => {
  it("preserves assistant tool_calls before appending tool results", async () => {
    const prisma = buildPrisma();
    prisma.whatsappAgentConfig.findFirst.mockResolvedValue({
      ...config,
      greetingAr: "أهلاً بك، كيف أقدر أساعدك؟",
    });
    const toolCall = {
      id: "call-1",
      function: { name: "lookupClient", arguments: "{}" },
    };
    const llm = {
      resolveApiKey: jest.fn().mockResolvedValue("key"),
      complete: jest.fn().mockResolvedValueOnce({
        content: null,
        toolCalls: [toolCall],
        tokensUsed: 10,
      }),
    };
    const tools = {
      listTools: jest.fn().mockReturnValue([]),
      execute: jest.fn().mockResolvedValue({ found: false }),
      getPendingBooking: jest.fn().mockResolvedValue(null),
    };
    const transport = {
      resolve: jest.fn().mockResolvedValue({
        client: {
          sendText: jest
            .fn()
            .mockResolvedValue({ ok: true, messageId: "out-1" }),
        },
      }),
    };
    const orchestrator = new AgentOrchestratorService(
      prisma as never,
      llm as never,
      tools as never,
      transport as never,
    );

    await orchestrator.handleInbound("+966500000000", "hello", "in-1");

    const firstRequest = llm.complete.mock.calls[0][0];
    expect(firstRequest.messages[0].content).toContain("موظف استقبال ودود");
    expect(firstRequest.messages[0].content).toContain(
      'Greeting source text for first contact: "أهلاً بك، كيف أقدر أساعدك؟"',
    );
    expect(firstRequest.messages[0].content).toContain(
      "Translate and adapt it naturally into the customer's language",
    );

    const firstCall = llm.complete.mock.calls[0][0];
    expect(firstCall.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          tool_calls: [toolCall],
        }),
      ]),
    );
  });

  it("resends a persisted pending reply without rerunning the LLM", async () => {
    const prisma = buildPrisma();
    prisma.whatsappMessage.findUnique.mockResolvedValue({
      id: "user-message-1",
      conversationId: "conversation-1",
      createdAt: new Date(),
      content: "hello",
      role: "USER",
    });
    prisma.whatsappMessage.findFirst.mockResolvedValue({
      id: "assistant-message-1",
      content: "persisted reply",
      deliveryStatus: "PENDING",
    });
    const llm = {
      resolveApiKey: jest.fn(),
      complete: jest.fn(),
    };
    const sendText = jest
      .fn()
      .mockResolvedValue({ ok: true, messageId: "out-1" });
    const orchestrator = new AgentOrchestratorService(
      prisma as never,
      llm as never,
      {
        listTools: jest.fn(),
        getPendingBooking: jest.fn().mockResolvedValue(null),
      } as never,
      {
        resolve: jest.fn().mockResolvedValue({ client: { sendText } }),
      } as never,
    );

    await orchestrator.handleInbound("+966500000000", "hello", "in-1");

    expect(llm.complete).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith({
      number: "+966500000000",
      text: "persisted reply",
    });
    expect(prisma.whatsappMessage.update).toHaveBeenCalledWith({
      where: { id: "assistant-message-1" },
      data: expect.objectContaining({
        deliveryStatus: "SENT",
        providerMessageId: "out-1",
      }),
    });
  });

  it("uses the complete prior history and only greets on first contact", async () => {
    const prisma = buildPrisma();
    prisma.whatsappAgentConfig.findFirst.mockResolvedValue({
      ...config,
      greetingAr: "أهلاً بك، كيف أقدر أساعدك؟",
    });
    prisma.whatsappMessage.findMany.mockResolvedValue([
      { role: "ASSISTANT", content: "أهلاً بك، كيف أقدر أساعدك؟" },
      { role: "USER", content: "أبغى أحجز موعد" },
    ]);
    const llm = {
      resolveApiKey: jest.fn().mockResolvedValue("key"),
      complete: jest.fn().mockResolvedValue({
        content: "أكيد، وش نوع الاستشارة؟",
        toolCalls: [],
        tokensUsed: 5,
      }),
    };
    const transport = {
      resolve: jest.fn().mockResolvedValue({
        client: {
          sendText: jest
            .fn()
            .mockResolvedValue({ ok: true, messageId: "out-1" }),
        },
      }),
    };
    const orchestrator = new AgentOrchestratorService(
      prisma as never,
      llm as never,
      {
        listTools: jest.fn().mockReturnValue([]),
        getPendingBooking: jest.fn().mockResolvedValue(null),
      } as never,
      transport as never,
    );

    await orchestrator.handleInbound(
      "+966500000000",
      "أبغى جلسة أسرية",
      "in-3",
    );

    expect(prisma.whatsappMessage.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: "conversation-1",
        id: { not: "user-message-1" },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { role: true, content: true, toolCalls: true, toolResults: true },
    });
    expect(llm.complete.mock.calls[0][0].messages[0].content).not.toContain(
      "Greeting to use for first contact",
    );
    expect(llm.complete.mock.calls[0][0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "أهلاً بك، كيف أقدر أساعدك؟",
        }),
        expect.objectContaining({ role: "user", content: "أبغى أحجز موعد" }),
      ]),
    );
  });

  it("does not call the LLM outside configured business hours", async () => {
    const prisma = buildPrisma();
    prisma.whatsappAgentConfig.findFirst.mockResolvedValue({
      ...config,
      businessHoursOnly: true,
    });
    const llm = { resolveApiKey: jest.fn(), complete: jest.fn() };
    const sendText = jest
      .fn()
      .mockResolvedValue({ ok: true, messageId: "out-1" });
    const orchestrator = new AgentOrchestratorService(
      prisma as never,
      llm as never,
      {
        listTools: jest.fn(),
        getPendingBooking: jest.fn().mockResolvedValue(null),
      } as never,
      {
        resolve: jest.fn().mockResolvedValue({ client: { sendText } }),
      } as never,
    );

    await orchestrator.handleInbound("+966500000000", "hello", "in-2");

    expect(llm.resolveApiKey).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith({
      number: "+966500000000",
      text: expect.stringContaining("ساعات العمل"),
    });
  });
});
