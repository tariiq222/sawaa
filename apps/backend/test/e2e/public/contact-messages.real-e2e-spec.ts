import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../../src/infrastructure/database";
import { createRealE2eApp, request } from "../../helpers/create-real-e2e-app";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Public Contact Messages (real e2e)", () => {
  jest.setTimeout(30_000);

  let app: INestApplication;
  let prisma: PrismaService;

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmail = `real-e2e-contact-${uniqueSuffix}@example.com`;
  const requestBody = {
    name: "Real E2E Tester",
    email: testEmail,
    phone: "+966501234567",
    subject: "Real database e2e smoke",
    body: "This message verifies that public contact messages persist to the real test database.",
  };

  beforeAll(async () => {
    const testApp = await createRealE2eApp();
    app = testApp.app;
    prisma = testApp.prisma;

    await prisma.contactMessage.deleteMany({ where: { email: testEmail } });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.contactMessage.deleteMany({ where: { email: testEmail } });
    }
    if (app) await app.close();
  });

  it("POST /api/v1/public/contact-messages persists a contact message in Postgres", async () => {
    await expect(
      prisma.contactMessage.count({ where: { email: testEmail } }),
    ).resolves.toBe(0);

    const res = await request(app.getHttpServer())
      .post("/api/v1/public/contact-messages")
      .send(requestBody)
      .expect(201);

    expect(res.body).toMatchObject({ status: "NEW" });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty("name");
    expect(res.body).not.toHaveProperty("email");
    expect(res.body).not.toHaveProperty("phone");
    expect(res.body).not.toHaveProperty("body");
    expect(res.body).not.toHaveProperty("token");
    expect(res.body).not.toHaveProperty("accessToken");
    expect(res.body).not.toHaveProperty("refreshToken");

    const responsePayload = JSON.stringify(res.body);
    expect(responsePayload).not.toContain(requestBody.name);
    expect(responsePayload).not.toContain(requestBody.email);
    expect(responsePayload).not.toContain(requestBody.phone);
    expect(responsePayload).not.toContain(requestBody.body);
    expect(responsePayload.toLowerCase()).not.toContain("token");

    const persisted = await prisma.contactMessage.findUnique({
      where: { id: res.body.id },
    });

    expect(persisted).toMatchObject({
      id: res.body.id,
      email: testEmail,
      name: requestBody.name,
      phone: requestBody.phone,
      status: "NEW",
      subject: requestBody.subject,
      body: requestBody.body,
    });

    await expect(
      prisma.contactMessage.count({ where: { email: testEmail } }),
    ).resolves.toBe(1);
  });
});
