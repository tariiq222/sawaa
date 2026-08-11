import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { WhatsappWebhookController } from "./whatsapp-webhook.controller";
import { WhatsappWebhookVerifier } from "../../modules/integrations/whatsapp/webhook/whatsapp-webhook-verifier";
import { WhatsappCredentialsService } from "../../infrastructure/whatsapp/whatsapp-credentials.service";
import { WhatsappEvolutionConfigService } from "../../infrastructure/whatsapp/whatsapp-evolution-config.service";
import { PrismaService } from "../../infrastructure/database";
import type { ConfigService } from "@nestjs/config";
import { DEFAULT_ORG_ID } from "../../common/constants";
import { WhatsappInboundQueueService } from "../../infrastructure/whatsapp/whatsapp-inbound-queue.service";

const mockSecret = "wh-test-secret-1234567890"; // gitleaks:allow -- test fixture
const rawBody = JSON.stringify({
  event: "messages.upsert",
  instance: "sawaa-main",
  data: {
    key: { remoteJid: "9665XXXXXXXX@s.whatsapp.net", id: "msg-1" },
    message: { conversation: "hi" },
  },
});

function buildCredentials(): WhatsappCredentialsService {
  const cfg: Partial<ConfigService> = {
    get: () => Buffer.alloc(32, 11).toString("base64"),
  };
  return new WhatsappCredentialsService(cfg as ConfigService);
}

describe("WhatsappWebhookController (security)", () => {
  let app: INestApplication;
  let credentials: WhatsappCredentialsService;
  let inboundQueue: { enqueue: jest.Mock };

  beforeEach(async () => {
    credentials = buildCredentials();
    inboundQueue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const prismaMock = {
      whatsappAgentConfig: {
        findFirst: jest.fn(),
      },
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappWebhookController],
      providers: [
        WhatsappWebhookVerifier,
        { provide: WhatsappCredentialsService, useValue: credentials },
        { provide: PrismaService, useValue: prismaMock },
        { provide: WhatsappInboundQueueService, useValue: inboundQueue },
        { provide: WhatsappEvolutionConfigService, useValue: { get: () => null } },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /public/whatsapp/webhook", () => {
    it("rejects a forged payload with no signature", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/public/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .send(rawBody)
        .expect(401);
      expect(inboundQueue.enqueue).not.toHaveBeenCalled();
    });

    it("rejects a forged payload with the wrong signature", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/public/whatsapp/webhook")
        .set("Authorization", "Bearer deadbeef")
        .set("Content-Type", "application/json")
        .send(rawBody)
        .expect(401);
      expect(inboundQueue.enqueue).not.toHaveBeenCalled();
    });

    it("accepts a signed payload when the config + signature match", async () => {
      // Configure the singleton row directly via the WhatsApp agent config table.
      // The controller does not know about it — the verifier reads it
      // through Prisma. To exercise the real flow we hit the controller
      // after stubbing the verifier's lookup. For a focused security
      // assertion we directly call the verifier through the wiring and
      // confirm it would invoke the orchestrator.
      const ciphertext = credentials.encrypt(
        { webhookSecret: mockSecret },
        DEFAULT_ORG_ID,
      );
      expect(typeof ciphertext).toBe("string");
      // Use the real verifier to validate. We've already established
      // independent coverage of the verifier in
      // whatsapp-webhook-verifier.spec.ts — here we only assert that the
      // controller routes through it correctly when the signature passes.
      const verifier = app.get(WhatsappWebhookVerifier);
      jest.spyOn(verifier, "verify").mockResolvedValue({
        ok: true,
        configId: "cfg-1",
        instanceName: "sawaa-main",
      });
      await request(app.getHttpServer())
        .post("/api/v1/public/whatsapp/webhook")
        .set("Authorization", "Bearer valid-token")
        .set("Content-Type", "application/json")
        .send(rawBody)
        .expect(200);
      expect(inboundQueue.enqueue).toHaveBeenCalledWith({
        instance: "sawaa-main",
        phone: "+9665XXXXXXXX",
        text: "hi",
        externalMessageId: "msg-1",
        rawBody,
      });
    });

    it("acknowledges non-message events without invoking the orchestrator", async () => {
      const verifier = app.get(WhatsappWebhookVerifier);
      jest.spyOn(verifier, "verify").mockResolvedValue({
        ok: true,
        configId: "cfg-1",
        instanceName: "sawaa-main",
      });
      const ping = JSON.stringify({
        event: "connection.update",
        instance: "sawaa-main",
      });
      await request(app.getHttpServer())
        .post("/api/v1/public/whatsapp/webhook")
        .set("Authorization", "Bearer valid-token")
        .set("Content-Type", "application/json")
        .send(ping)
        .expect(200);
      expect(inboundQueue.enqueue).not.toHaveBeenCalled();
    });
  });
});
