import { createHmac } from "crypto";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { WhatsappCredentialsService } from "../../../../infrastructure/whatsapp/whatsapp-credentials.service";
import { DEFAULT_ORG_ID } from "../../../../common/constants";
import { WhatsappWebhookVerifier } from "./whatsapp-webhook-verifier";

function buildCreds(): WhatsappCredentialsService {
  const cfg: Partial<ConfigService> = {
    get: () => Buffer.alloc(32, 9).toString("base64"),
  };
  return new WhatsappCredentialsService(cfg as ConfigService);
}

function buildPrisma(configRow: unknown) {
  return {
    whatsappAgentConfig: {
      findFirst: jest.fn().mockResolvedValue(configRow),
    },
  };
}

describe("WhatsappWebhookVerifier", () => {
  const secret = "wh-secret-test-1234567890"; // gitleaks:allow -- test fixture
  const rawBody = JSON.stringify({
    event: "messages.upsert",
    instance: "sawaa-main",
    data: { key: { remoteJid: "9665XXXXXXXX@s.whatsapp.net", id: "abc-1" } },
  });

  function signToken(
    payload: Record<string, unknown>,
    signingSecret = secret,
    header: Record<string, unknown> = { alg: "HS256", typ: "JWT" },
  ): string {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode(header)}.${encode(payload)}`;
    const signature = createHmac("sha256", signingSecret).update(unsigned).digest("base64url");
    return `${unsigned}.${signature}`;
  }

  function validToken(
    overrides: Record<string, unknown> = {},
    signingSecret = secret,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    return signToken({
      app: "evolution",
      action: "webhook",
      iat: now,
      exp: now + 300,
      ...overrides,
    }, signingSecret);
  }

  function buildVerifier(configRow: unknown) {
    const prisma = buildPrisma(configRow);
    const hasSecret = (configRow as { webhookSecretEnc?: string | null } | null)
      ?.webhookSecretEnc;
    const evolutionConfig = {
      get: jest.fn().mockReturnValue({
        baseUrl: "https://evolution.example.com",
        instanceName: "sawaa-main",
        apiKey: "evolution-key",
        webhookSecret: hasSecret ? secret : null,
      }),
    };
    return {
      verifier: new WhatsappWebhookVerifier(prisma as never, evolutionConfig as never),
      prisma,
    };
  }

  it("accepts a valid Evolution webhook JWT", async () => {
    const creds = buildCreds();
    const webhookSecretEnc = creds.encrypt({ webhookSecret: secret }, DEFAULT_ORG_ID);
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc,
      isActive: true,
    });

    const res = await verifier.verify({
      rawBody,
      authorization: `Bearer ${validToken()}`,
      payloadInstance: "sawaa-main",
    });
    expect(res).toEqual({ ok: true, configId: "cfg-1", instanceName: "sawaa-main" });
  });

  it("rejects an empty signature", async () => {
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc: "anything",
      isActive: true,
    });
    await expect(
      verifier.verify({ rawBody, authorization: undefined }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a wrong signature without exposing the secret", async () => {
    const creds = buildCreds();
    const webhookSecretEnc = creds.encrypt({ webhookSecret: secret }, DEFAULT_ORG_ID);
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc,
      isActive: true,
    });
    await expect(
      verifier.verify({ rawBody, authorization: `Bearer ${validToken({}, "wrong-secret")}` }),
    ).rejects.toThrow(/Invalid webhook token/);
  });

  it("rejects an expired token", async () => {
    const creds = buildCreds();
    const webhookSecretEnc = creds.encrypt({ webhookSecret: secret }, DEFAULT_ORG_ID);
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc,
      isActive: true,
    });
    await expect(
      verifier.verify({
        rawBody,
        authorization: `Bearer ${validToken({ exp: Math.floor(Date.now() / 1000) - 1 })}`,
      }),
    ).rejects.toThrow(/expired/i);
  });

  it("rejects a token that does not use HS256", async () => {
    const creds = buildCreds();
    const webhookSecretEnc = creds.encrypt({ webhookSecret: secret }, DEFAULT_ORG_ID);
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc,
      isActive: true,
    });
    const unsignedToken = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ instanceName: "sawaa-main" })).toString("base64url")}.`;

    await expect(
      verifier.verify({ rawBody, authorization: `Bearer ${unsignedToken}` }),
    ).rejects.toThrow(/Invalid webhook token/);
  });

  it("rejects a payload from a different instance (replay protection)", async () => {
    const creds = buildCreds();
    const webhookSecretEnc = creds.encrypt({ webhookSecret: secret }, DEFAULT_ORG_ID);
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc,
      isActive: true,
    });
    await expect(
      verifier.verify({
        rawBody,
        authorization: `Bearer ${validToken()}`,
        payloadInstance: "attacker-instance",
      }),
    ).rejects.toThrow(/instance mismatch/i);
  });

  it("rejects when no webhook secret is on file", async () => {
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc: null,
      isActive: true,
    });
    await expect(
      verifier.verify({ rawBody, authorization: `Bearer ${validToken()}` }),
    ).rejects.toThrow(/not configured/i);
  });

  it("rejects when the agent is inactive", async () => {
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc: "anything",
      isActive: false,
    });
    await expect(
      verifier.verify({ rawBody, authorization: `Bearer ${validToken()}` }),
    ).rejects.toThrow(/not configured/);
  });

  it("rejects an empty body", async () => {
    const creds = buildCreds();
    const webhookSecretEnc = creds.encrypt({ webhookSecret: secret }, DEFAULT_ORG_ID);
    const { verifier } = buildVerifier({
      id: "cfg-1",
      evolutionInstanceName: "sawaa-main",
      webhookSecretEnc,
      isActive: true,
    });
    await expect(
      verifier.verify({ rawBody: "", authorization: `Bearer ${validToken()}` }),
    ).rejects.toThrow(BadRequestException);
  });
});
