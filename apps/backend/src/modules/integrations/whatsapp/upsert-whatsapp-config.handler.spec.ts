import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { WhatsappCredentialsService } from "../../../infrastructure/whatsapp/whatsapp-credentials.service";
import { EvolutionUrlValidator } from "../../../infrastructure/whatsapp/evolution-url.validator";
import { DEFAULT_ORG_ID } from "../../../common/constants";
import { UpsertWhatsappConfigHandler } from "./upsert-whatsapp-config.handler";

// node:dns/promises is mocked so the SSRF suite is deterministic.
jest.mock("node:dns/promises", () => {
  const actual = jest.requireActual("node:dns/promises") as Record<string, unknown>;
  return {
    ...actual,
    lookup: jest.fn(async () => [{ address: "198.51.100.10", family: 4 }]),
  };
});

function buildCfg(): ConfigService {
  return {
    get: (key: string) => {
      if (key === "NODE_ENV") return "production";
      if (key === "API_PUBLIC_URL") return "https://api.sawaa.app";
      return undefined;
    },
  } as unknown as ConfigService;
}

function buildCreds(): WhatsappCredentialsService {
  const cfg: Partial<ConfigService> = {
    get: () => Buffer.alloc(32, 4).toString("base64"),
  };
  return new WhatsappCredentialsService(cfg as ConfigService);
}

describe("UpsertWhatsappConfigHandler", () => {
  let existingRow: {
    id: string;
    provider: "EVOLUTION_API";
    evolutionBaseUrl: string | null;
    evolutionInstanceName: string | null;
    credentialsCiphertext: string | null;
    webhookSecretEnc: string | null;
    isActive: boolean;
  } | null = null;
  let lastUpserted: { data: Record<string, unknown>; where?: { id: string } } | null = null;
  let lastCreateCalled = false;
  let lastCreateData: Record<string, unknown> | null = null;
  let firstUpdateData: Record<string, unknown> | null = null;
  let updateCallCount = 0;

  function buildHandler() {
    const creds = buildCreds();
    const validator = new EvolutionUrlValidator(buildCfg());
    const prisma = {
      whatsappAgentConfig: {
        findFirst: jest.fn().mockImplementation(async () => existingRow),
        update: jest.fn().mockImplementation(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          updateCallCount++;
          // The first update carries the credentials; later updates only
          // stamp lastTestAt / lastTestOk — capture only the first for
          // assertions.
          if (updateCallCount === 1) {
            firstUpdateData = args.data;
          }
          lastUpserted = { data: args.data, where: args.where };
          return { id: args.where.id };
        }),
        create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
          lastCreateCalled = true;
          lastCreateData = args.data;
          lastUpserted = { data: args.data };
          return { id: "new-id", ...args.data };
        }),
      },
    };
    return {
      handler: new UpsertWhatsappConfigHandler(prisma as never, creds, validator, buildCfg()),
      prisma,
      creds,
    };
  }

  beforeEach(() => {
    existingRow = null;
    lastUpserted = null;
    lastCreateData = null;
    firstUpdateData = null;
    updateCallCount = 0;
  });

  it("requires evolutionBaseUrl + evolutionInstanceName for EVOLUTION_API", async () => {
    const { handler } = buildHandler();
    await expect(
      handler.execute({
        provider: "EVOLUTION_API",
        evolutionBaseUrl: undefined,
        evolutionInstanceName: undefined,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects http base URLs in production", async () => {
    const { handler } = buildHandler();
    await expect(
      handler.execute({
        provider: "EVOLUTION_API",
        evolutionBaseUrl: "http://evolution-public.example.com",
        evolutionInstanceName: "sawaa-main",
        evolutionApiKey: "test-key",
      }),
    ).rejects.toThrow(/HTTPS/);
  });

  it("encrypts a fresh API key when no prior config exists", async () => {
    const { handler, creds } = buildHandler();
    const result = await handler.execute({
      provider: "EVOLUTION_API",
      evolutionBaseUrl: "https://evolution-public.example.com",
      evolutionInstanceName: "sawaa-main",
      evolutionApiKey: "fresh-key",
    });
    expect(result.configured).toBe(true);
    expect(lastCreateCalled).toBe(true);
    const stored = creds.decrypt<{ evolutionApiKey?: string }>(
      lastCreateData!.credentialsCiphertext as string,
      DEFAULT_ORG_ID,
    );
    expect(stored.evolutionApiKey).toBe("fresh-key");
  });

  it("requires a fresh API key when the origin changes (anti-leak)", async () => {
    const creds = buildCreds();
    existingRow = {
      id: "cfg-1",
      provider: "EVOLUTION_API",
      evolutionBaseUrl: "https://evolution-public.example.com",
      evolutionInstanceName: "sawaa-main",
      credentialsCiphertext: creds.encrypt(
        { evolutionApiKey: "old-key" },
        DEFAULT_ORG_ID,
      ),
      webhookSecretEnc: null,
      isActive: true,
    };
    const { handler } = buildHandler();
    await expect(
      handler.execute({
        provider: "EVOLUTION_API",
        evolutionBaseUrl: "https://evolution.attacker.example",
        evolutionInstanceName: "sawaa-main",
        // intentionally NO evolutionApiKey — must be rejected
      }),
    ).rejects.toThrow(/changing the Evolution base URL/);
  });

  it("accepts a same-origin re-save without a new API key", async () => {
    const creds = buildCreds();
    existingRow = {
      id: "cfg-1",
      provider: "EVOLUTION_API",
      evolutionBaseUrl: "https://evolution-public.example.com",
      evolutionInstanceName: "sawaa-main",
      credentialsCiphertext: creds.encrypt(
        { evolutionApiKey: "stored-key" },
        DEFAULT_ORG_ID,
      ),
      webhookSecretEnc: null,
      isActive: true,
    };
    const { handler, creds: c2 } = buildHandler();
    await handler.execute({
      provider: "EVOLUTION_API",
      evolutionBaseUrl: "https://evolution-public.example.com",
      evolutionInstanceName: "sawaa-main-renamed",
      // no api key — must reuse stored key
    });
    const stored = c2.decrypt<{ evolutionApiKey?: string }>(
      firstUpdateData!.credentialsCiphertext as string,
      DEFAULT_ORG_ID,
    );
    expect(stored.evolutionApiKey).toBe("stored-key");
  });

  it("registers an authenticated webhook after successful verification", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ instance: { state: "open" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { handler } = buildHandler();

    const result = await handler.execute({
      provider: "EVOLUTION_API",
      evolutionBaseUrl: "https://evolution-public.example.com",
      evolutionInstanceName: "sawaa-main",
      evolutionApiKey: "fresh-key",
      webhookSecret: "jwt-secret-1234567890",
    });

    expect(result.verified).toBe(true);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "https://evolution-public.example.com/webhook/set/sawaa-main",
      expect.objectContaining({
        body: expect.stringContaining('"jwt_key":"jwt-secret-1234567890"'),
      }),
    );
  });
});

declare const prismaSpyCreate: jest.Mock; // typed above via lastCreateCalled flag
