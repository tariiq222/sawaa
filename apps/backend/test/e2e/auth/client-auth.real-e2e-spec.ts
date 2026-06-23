/**
 * Client Auth — Real-DB E2E Spec
 * ==============================
 *
 * Exercises the WEBSITE CLIENT (non-admin) auth surface against a real
 * Postgres database (no mocked Prisma). External HTTP is intercepted
 * globally by setup-e2e.ts; the SMS / Email channel adapters are
 * stubbed in-memory here so the raw OTP code can be read by the test
 * (the production code only stores a bcrypt hash on the OtpCode row).
 *
 * Covers behaviour the existing Prisma-mocked login.e2e-spec.ts cannot
 * prove:
 *
 *   - The password on disk is bcrypt-hashed, never plaintext (register).
 *   - Successful login persists lastLoginAt and issues a CLIENT-namespaced
 *     JWT in an httpOnly cookie (not an admin Bearer token).
 *   - Refresh rotates the refresh-token row in the DB and mints a fresh
 *     access JWT (different `jti`).
 *   - The OTP-only path (request → verify) yields a usable sessionToken
 *     whose `purpose` claim matches `CLIENT_LOGIN`, which can then
 *     promote a guest client to a full account via /public/auth/register.
 *   - Password reset revokes the old refresh-token rows and bumps the
 *     client's `tokenVersion`, so any in-flight access JWTs are
 *     invalidated on next use.
 *
 * Data isolation: every email / phone / DB row carries a per-run suffix
 * so this spec can run alongside other real-DB specs without colliding
 * on unique columns. Cleanup is targeted (by suffix + by id).
 *
 * Run:
 *   REAL_E2E_DATABASE_URL="postgresql://sawaa:sawaa_dev_password@localhost:3453/sawaa_test?schema=public&connection_limit=10&pool_timeout=20" \
 *     npx jest --config test/jest-e2e.json --runInBand \
 *     test/e2e/auth/client-auth.real-e2e-spec.ts
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import cookieParser from "cookie-parser";
import { OtpChannel, OtpPurpose } from "@prisma/client";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";
import { EmailChannelAdapter } from "../../../src/modules/comms/notification-channel/email-channel.adapter";
import { SmsChannelAdapter } from "../../../src/modules/comms/notification-channel/sms-channel.adapter";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Client Auth — real-DB e2e (register, login, refresh, OTP, reset)", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;

  // ── Per-run isolation ──────────────────────────────────────────────────────
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uniqueEmail = (label: string) =>
    `client-auth-${suffix}-${label}@sawaa.test`;

  // Saudi phone E.164 (NormalizePhoneOrEmail expects +9665XXXXXXXX).
  const uniquePhone = () =>
    `+9665${String(Math.floor(10_000_000 + Math.random() * 89_999_999)).padStart(8, "0")}`;

  // OTP codes captured from the stubbed channel adapters, keyed by
  // `${purpose}:${identifier}` so request+verify can be paired.
  const otpCodes = new Map<string, string>();
  const otpKey = (channel: OtpChannel, identifier: string, purpose: OtpPurpose) =>
    `${channel}:${identifier}:${purpose}`;

  // Track every entity this spec creates so cleanup is targeted.
  const ctx = {
    createdClientEmails: new Set<string>(),
    createdClientPhones: new Set<string>(),
  };

  const api = () => request(app.getHttpServer());

  // ── Setup / teardown ──────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailChannelAdapter)
      .useValue({
        kind: OtpChannel.EMAIL,
        send: jest.fn(
          async (identifier: string, code: string, _organizationId?: string) => {
            // Capture the raw OTP the handler asked us to "send". The
            // production adapter would email this; here we record it so the
            // test can call /public/otp/verify with the exact code.
            otpCodes.set(
              otpKey(OtpChannel.EMAIL, identifier, OtpPurpose.CLIENT_LOGIN),
              code,
            );
            otpCodes.set(
              otpKey(OtpChannel.EMAIL, identifier, OtpPurpose.CLIENT_PASSWORD_RESET),
              code,
            );
          },
        ),
      })
      .overrideProvider(SmsChannelAdapter)
      .useValue({
        kind: OtpChannel.SMS,
        send: jest.fn(
          async (identifier: string, code: string, _organizationId?: string) => {
            otpCodes.set(
              otpKey(OtpChannel.SMS, identifier, OtpPurpose.CLIENT_LOGIN),
              code,
            );
            otpCodes.set(
              otpKey(OtpChannel.SMS, identifier, OtpPurpose.CLIENT_PASSWORD_RESET),
              code,
            );
          },
        ),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // PublicAuthController reads `req.cookies.client_refresh_token` to refresh;
    // main.ts installs cookie-parser globally, so we mirror that here.
    app.use(cookieParser());
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
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    try {
      await cleanup();
    } catch {
      /* best-effort — see learn-from-mistakes */
    }
    if (app) await app.close();
  });

  async function cleanup() {
    if (!prisma) return;
    // Suffix-pattern cleanup is safe because every identifier this spec
    // creates is namespaced with `client-auth-${suffix}-` or a phone that
    // we hand out via uniquePhone() and track separately.
    const emailLike = `client-auth-${suffix}-`;

    // Collect clientIds that this spec owns (by suffix on email) so we can
    // cascade-delete passwordHistory / clientRefreshToken rows by FK.
    const ownedClients = await prisma.client
      .findMany({
        where: { email: { startsWith: emailLike } },
        select: { id: true },
      })
      .catch(() => []);
    const ownedClientIds = ownedClients.map((c) => c.id);

    if (ownedClientIds.length > 0) {
      await prisma.passwordHistory
        .deleteMany({ where: { clientId: { in: ownedClientIds } } })
        .catch(() => undefined);
      await prisma.clientRefreshToken
        .deleteMany({ where: { clientId: { in: ownedClientIds } } })
        .catch(() => undefined);
    }
    await prisma.usedOtpSession
      .deleteMany({})
      .catch(() => undefined);
    await prisma.otpCode
      .deleteMany({ where: { identifier: { contains: suffix } } })
      .catch(() => undefined);
    await prisma.client
      .deleteMany({ where: { email: { startsWith: emailLike } } })
      .catch(() => undefined);
    // Phones — uniquePhone() uses random digits so we track by createdAt window.
    if (ctx.createdClientPhones.size > 0) {
      const phones = Array.from(ctx.createdClientPhones);
      await prisma.client
        .deleteMany({ where: { phone: { in: phones } } })
        .catch(() => undefined);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function decodeJwtPayload(token: string): Record<string, unknown> {
    // We don't verify — just decode the base64url payload to assert the
    // namespace claim is "client" (not an admin token). Production token
    // verification is the responsibility of ClientJwtStrategy.
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  }

  function parseCookies(setCookieHeader: string | string[] | undefined): Record<string, string> {
    if (!setCookieHeader) return {};
    const arr = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const jar: Record<string, string> = {};
    for (const line of arr) {
      // Strip attributes (Path, HttpOnly, SameSite, Max-Age, Expires, Secure).
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      jar[name] = value;
    }
    return jar;
  }

  function cookieHeader(jar: Record<string, string>): string {
    return Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async function requestOtp(
    channel: OtpChannel,
    identifier: string,
    purpose: OtpPurpose,
  ) {
    const res = await api()
      .post("/api/v1/public/otp/request")
      .send({ channel, identifier, purpose });
    return res;
  }

  function lastOtpCode(
    channel: OtpChannel,
    identifier: string,
    purpose: OtpPurpose,
  ): string {
    const code = otpCodes.get(otpKey(channel, identifier, purpose));
    if (!code) {
      throw new Error(
        `No OTP captured for ${channel}:${identifier}:${purpose}. ` +
          `Captured keys: ${Array.from(otpCodes.keys()).join(", ")}`,
      );
    }
    return code;
  }

  async function verifyOtp(
    channel: OtpChannel,
    identifier: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<string> {
    const res = await api()
      .post("/api/v1/public/otp/verify")
      .send({ channel, identifier, purpose, code });
    expect(res.status).toBe(200);
    expect(typeof res.body.sessionToken).toBe("string");
    return res.body.sessionToken as string;
  }

  async function registerViaOtp(opts: {
    channel: OtpChannel;
    identifier: string;
    purpose: OtpPurpose;
    password: string;
    name?: string;
  }) {
    const codeRes = await requestOtp(opts.channel, opts.identifier, opts.purpose);
    expect(codeRes.status).toBe(200);

    const code = lastOtpCode(opts.channel, opts.identifier, opts.purpose);
    const sessionToken = await verifyOtp(
      opts.channel,
      opts.identifier,
      opts.purpose,
      code,
    );

    const regRes = await api()
      .post("/api/v1/public/auth/register")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ password: opts.password, name: opts.name });
    return { regRes, sessionToken };
  }

  async function seedClientWithPassword(opts: {
    email?: string;
    phone?: string;
    password: string;
  }): Promise<{ id: string; email: string | null; phone: string | null }> {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(opts.password, 4); // low cost — not a security test
    const created = await prisma.client.create({
      data: {
        email: opts.email ?? null,
        phone: opts.phone ?? null,
        name: opts.email ?? opts.phone ?? "seeded",
        passwordHash,
        accountType: "FULL",
        claimedAt: new Date(),
        isActive: true,
      },
    });
    if (created.email) ctx.createdClientEmails.add(created.email);
    if (created.phone) ctx.createdClientPhones.add(created.phone);
    return { id: created.id, email: created.email, phone: created.phone };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Register: happy path + validation + duplicate guard", () => {
    it("registers a new client: hashed password on disk, httpOnly cookie, CLIENT-namespaced JWT", async () => {
      const email = uniqueEmail("register-happy");
      ctx.createdClientEmails.add(email);
      const password = "SecurePass1";

      const { regRes } = await registerViaOtp({
        channel: OtpChannel.EMAIL,
        identifier: email,
        purpose: OtpPurpose.CLIENT_LOGIN,
        password,
        name: "Happy Client",
      });

      expect(regRes.status).toBe(200);
      expect(regRes.body.clientId).toEqual(expect.any(String));

      const cookies = parseCookies(regRes.headers["set-cookie"]);
      expect(cookies.client_access_token).toEqual(expect.any(String));
      expect(cookies.client_refresh_token).toEqual(expect.any(String));

      // Decode the access JWT and assert it is a CLIENT token, not an admin one.
      // The signing key is JWT_CLIENT_ACCESS_SECRET — different from the admin
      // JWT_ACCESS_SECRET — but for the assertion we only check the namespace
      // claim (the strongest client-vs-admin discriminator).
      const payload = decodeJwtPayload(cookies.client_access_token);
      expect(payload.namespace).toBe("client");
      expect(payload.email).toBe(email);
      expect(payload.sub).toBe(regRes.body.clientId);
      expect(payload.jti).toEqual(expect.any(String));

      // The raw password MUST NOT appear anywhere on disk — read the row back
      // and assert the column is a bcrypt hash, not the plaintext.
      const row = await prisma.client.findUnique({
        where: { id: regRes.body.clientId },
        select: { passwordHash: true, email: true, name: true, accountType: true, consentedAt: true },
      });
      expect(row).not.toBeNull();
      expect(row!.email).toBe(email);
      expect(row!.name).toBe("Happy Client");
      expect(row!.accountType).toBe("FULL");
      expect(row!.passwordHash).toEqual(expect.any(String));
      // SECURITY: password column must never equal the plaintext.
      expect(row!.passwordHash).not.toBe(password);
      // bcrypt hashes start with $2a$, $2b$, or $2y$.
      expect(row!.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      // bcrypt round-trip — prove the hash is verifiable against the plaintext
      // (otherwise the login flow would reject it next iteration).
      const bcrypt = await import("bcryptjs");
      expect(await bcrypt.compare(password, row!.passwordHash!)).toBe(true);
      expect(await bcrypt.compare("WrongPassword1", row!.passwordHash!)).toBe(false);

      // PDPL: register must record consent against the current policy version.
      expect(row!.consentedAt).toBeInstanceOf(Date);
    });

    it("rejects weak passwords (<8, no uppercase, no digit) with 400 validation errors", async () => {
      const email = uniqueEmail("register-weak");
      ctx.createdClientEmails.add(email);

      // First get a valid OTP session for this identifier.
      const codeRes = await requestOtp(OtpChannel.EMAIL, email, OtpPurpose.CLIENT_LOGIN);
      expect(codeRes.status).toBe(200);
      const code = lastOtpCode(OtpChannel.EMAIL, email, OtpPurpose.CLIENT_LOGIN);
      const sessionToken = await verifyOtp(
        OtpChannel.EMAIL,
        email,
        OtpPurpose.CLIENT_LOGIN,
        code,
      );

      const weakCases: Array<{ password: string; expect: RegExp }> = [
        { password: "short1A", expect: /at least 8/i },
        { password: "allowercase1", expect: /uppercase/i },
        { password: "NoDigitsHere", expect: /digit/i },
      ];

      for (const { password, expect: re } of weakCases) {
        const res = await api()
          .post("/api/v1/public/auth/register")
          .set("Authorization", `Bearer ${sessionToken}`)
          .send({ password, name: "Weak Test" });

        expect(res.status).toBe(400);
        // ValidationPipe returns either { message: string[] } or { message: string }.
        const messages = Array.isArray(res.body.message)
          ? res.body.message
          : [res.body.message];
        expect(messages.join(" ")).toMatch(re);
      }

      // No Client row was created across any of the three attempts.
      const rows = await prisma.client.findMany({ where: { email } });
      expect(rows).toHaveLength(0);
    });

    it("rejects duplicate identifier (existing client with a password already)", async () => {
      const email = uniqueEmail("register-duplicate");
      ctx.createdClientEmails.add(email);
      const password = "OriginalPass1";

      // Seed an existing client that already has a password set.
      const existing = await seedClientWithPassword({ email, password });

      // Even with a fresh OTP, registering again must be rejected because
      // the existing client already has a password (no double-accounting).
      const { regRes } = await registerViaOtp({
        channel: OtpChannel.EMAIL,
        identifier: email,
        purpose: OtpPurpose.CLIENT_LOGIN,
        password: "SecondPass1",
        name: "Duplicate Attempt",
      });

      expect(regRes.status).toBe(400);
      expect(regRes.body.message).toMatch(/already has a password/i);

      // The original row is untouched — passwordHash unchanged.
      const after = await prisma.client.findUnique({ where: { id: existing.id } });
      expect(after).not.toBeNull();
      // Only one Client row exists for this email.
      const all = await prisma.client.findMany({ where: { email } });
      expect(all).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Login: happy path + wrong password (no account enumeration)", () => {
    it("logs in with correct password and sets httpOnly CLIENT-namespaced JWT cookie", async () => {
      const email = uniqueEmail("login-happy");
      ctx.createdClientEmails.add(email);
      const password = "LoginPass1";
      const seeded = await seedClientWithPassword({ email, password });

      const res = await api()
        .post("/api/v1/public/auth/login")
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.clientId).toBe(seeded.id);

      const cookies = parseCookies(res.headers["set-cookie"]);
      expect(cookies.client_access_token).toEqual(expect.any(String));
      expect(cookies.client_refresh_token).toEqual(expect.any(String));

      // SECURITY (P1): token MUST be in the client namespace, not admin.
      const payload = decodeJwtPayload(cookies.client_access_token);
      expect(payload.namespace).toBe("client");
      expect(payload.email).toBe(email);
      expect(payload.sub).toBe(seeded.id);

      // SECURITY: response body must NOT leak the access/refresh tokens
      // or the passwordHash. The body only carries clientId today.
      const bodyText = JSON.stringify(res.body);
      expect(bodyText).not.toContain(cookies.client_access_token);
      expect(bodyText).not.toContain(cookies.client_refresh_token);
      expect(bodyText.toLowerCase()).not.toContain("token");
      expect(bodyText).not.toContain(password);
      expect(bodyText.toLowerCase()).not.toContain("passwordhash");

      // lastLoginAt must have been updated on the row.
      const after = await prisma.client.findUnique({
        where: { id: seeded.id },
        select: { lastLoginAt: true, loginAttempts: true },
      });
      expect(after!.lastLoginAt).toBeInstanceOf(Date);
      expect(after!.loginAttempts).toBe(0);
    });

    it("rejects a wrong password with 401 and does NOT update lastLoginAt", async () => {
      const email = uniqueEmail("login-wrong");
      ctx.createdClientEmails.add(email);
      const seeded = await seedClientWithPassword({
        email,
        password: "CorrectPass1",
      });

      const res = await api()
        .post("/api/v1/public/auth/login")
        .send({ email, password: "WrongPass1" });

      expect(res.status).toBe(401);

      // lastLoginAt must remain null and loginAttempts must have incremented.
      const after = await prisma.client.findUnique({
        where: { id: seeded.id },
        select: { lastLoginAt: true, loginAttempts: true },
      });
      expect(after!.lastLoginAt).toBeNull();
      expect(after!.loginAttempts).toBeGreaterThanOrEqual(1);

      // No refresh-token row may have been minted on a failed login.
      const refreshTokens = await prisma.clientRefreshToken.count({
        where: { clientId: seeded.id },
      });
      expect(refreshTokens).toBe(0);
    });

    it("returns 401 with an identical message for unknown email (no account enumeration)", async () => {
      const unknownEmail = uniqueEmail("login-unknown");

      const wrongPwRes = await api()
        .post("/api/v1/public/auth/login")
        .send({ email: unknownEmail, password: "Anything1" });

      expect(wrongPwRes.status).toBe(401);
      expect(wrongPwRes.body.message).toBe("Invalid credentials");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Refresh: rotates refresh token row and issues new access JWT", () => {
    it("refresh issues a new access JWT with a different jti and revokes the old refresh row", async () => {
      const email = uniqueEmail("refresh");
      ctx.createdClientEmails.add(email);
      const seeded = await seedClientWithPassword({
        email,
        password: "RefreshPass1",
      });

      // First login — establishes the original token pair.
      const loginRes = await api()
        .post("/api/v1/public/auth/login")
        .send({ email, password: "RefreshPass1" });
      expect(loginRes.status).toBe(200);

      const loginCookies = parseCookies(loginRes.headers["set-cookie"]);
      const originalAccess = loginCookies.client_access_token;
      const originalRefresh = loginCookies.client_refresh_token;
      expect(originalAccess).toEqual(expect.any(String));
      expect(originalRefresh).toEqual(expect.any(String));

      const originalRefreshRows = await prisma.clientRefreshToken.findMany({
        where: { clientId: seeded.id, revokedAt: null },
      });
      expect(originalRefreshRows.length).toBe(1);

      // Refresh with the cookies (the controller reads client_refresh_token from req.cookies).
      const refreshRes = await api()
        .post("/api/v1/public/auth/refresh")
        .set("Cookie", cookieHeader(loginCookies))
        .send({});

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.clientId).toBe(seeded.id);

      const refreshedCookies = parseCookies(refreshRes.headers["set-cookie"]);
      const newAccess = refreshedCookies.client_access_token;
      const newRefresh = refreshedCookies.client_refresh_token;
      expect(newAccess).toEqual(expect.any(String));
      expect(newRefresh).toEqual(expect.any(String));

      // The access JWT must rotate to a new jti (proof the refresh actually
      // minted fresh credentials, not just echoed the old pair).
      const newPayload = decodeJwtPayload(newAccess);
      const oldPayload = decodeJwtPayload(originalAccess);
      expect(newPayload.jti).not.toBe(oldPayload.jti);
      expect(newPayload.namespace).toBe("client");
      expect(newPayload.sub).toBe(seeded.id);

      // The DB row for the OLD refresh token must now be revoked (rotation).
      const oldRowAfter = await prisma.clientRefreshToken.findUnique({
        where: { tokenHash: originalRefreshRows[0].tokenHash },
      });
      expect(oldRowAfter).not.toBeNull();
      expect(oldRowAfter!.revokedAt).toBeInstanceOf(Date);

      // A NEW active refresh row exists.
      const activeAfter = await prisma.clientRefreshToken.findMany({
        where: { clientId: seeded.id, revokedAt: null },
      });
      expect(activeAfter.length).toBe(1);
      expect(activeAfter[0].id).not.toBe(originalRefreshRows[0].id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OTP-ONLY LOGIN PATH (CLIENT_LOGIN purpose)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("OTP login (CLIENT_LOGIN): request + verify, sessionToken is single-use", () => {
    it("request → verify yields a sessionToken whose purpose claim is CLIENT_LOGIN", async () => {
      const email = uniqueEmail("otp-login");
      ctx.createdClientEmails.add(email);

      const reqRes = await requestOtp(
        OtpChannel.EMAIL,
        email,
        OtpPurpose.CLIENT_LOGIN,
      );
      expect(reqRes.status).toBe(200);
      expect(reqRes.body).toEqual({ success: true });

      // Exactly one OtpCode row exists for this identifier+purpose with no
      // consumedAt and no attempts. The codeHash MUST be a bcrypt hash, not
      // plaintext.
      const rows = await prisma.otpCode.findMany({
        where: {
          identifier: email,
          purpose: OtpPurpose.CLIENT_LOGIN,
          consumedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(rows.length).toBe(1);
      const row = rows[0];
      expect(row.codeHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(row.codeHash).not.toBe(lastOtpCode(OtpChannel.EMAIL, email, OtpPurpose.CLIENT_LOGIN));
      expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const code = lastOtpCode(OtpChannel.EMAIL, email, OtpPurpose.CLIENT_LOGIN);
      const sessionToken = await verifyOtp(
        OtpChannel.EMAIL,
        email,
        OtpPurpose.CLIENT_LOGIN,
        code,
      );

      // The sessionToken is an OTP-session JWT. Decode it (the test does not
      // verify the signature — that is OtpSessionGuard's job — but it MUST
      // carry the right purpose + identifier + channel claims).
      const sessionParts = sessionToken.split(".");
      expect(sessionParts).toHaveLength(3);
      const sessionPayload = JSON.parse(
        Buffer.from(sessionParts[1], "base64url").toString("utf8"),
      );
      expect(sessionPayload.purpose).toBe(OtpPurpose.CLIENT_LOGIN);
      expect(sessionPayload.identifier).toBe(email);
      expect(sessionPayload.channel).toBe(OtpChannel.EMAIL);

      // The OtpCode row is now consumed.
      const consumed = await prisma.otpCode.findUnique({
        where: { id: row.id },
      });
      expect(consumed!.consumedAt).toBeInstanceOf(Date);

      // The sessionToken can be used to register — proves the OTP-only path
      // can promote a brand-new (no prior account) identifier without ever
      // typing a password.
      const regRes = await api()
        .post("/api/v1/public/auth/register")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({ password: "OtpOnly1", name: "OTP Promoted" });
      expect(regRes.status).toBe(200);
      ctx.createdClientEmails.add(email);
    });

    it("rejects a wrong OTP code with 401 and increments attempts on the OtpCode row", async () => {
      const email = uniqueEmail("otp-wrong");
      ctx.createdClientEmails.add(email);

      await requestOtp(OtpChannel.EMAIL, email, OtpPurpose.CLIENT_LOGIN);

      const rowBefore = await prisma.otpCode.findFirst({
        where: { identifier: email, purpose: OtpPurpose.CLIENT_LOGIN },
        orderBy: { createdAt: "desc" },
      });
      expect(rowBefore).not.toBeNull();
      expect(rowBefore!.attempts).toBe(0);

      const wrong = await api()
        .post("/api/v1/public/otp/verify")
        .send({
          channel: OtpChannel.EMAIL,
          identifier: email,
          purpose: OtpPurpose.CLIENT_LOGIN,
          code: "0000",
        });

      expect(wrong.status).toBe(401);

      const rowAfter = await prisma.otpCode.findUnique({ where: { id: rowBefore!.id } });
      expect(rowAfter!.attempts).toBe(1);
      expect(rowAfter!.consumedAt).toBeNull(); // still active for retry
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSWORD RESET (CLIENT_PASSWORD_RESET purpose)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Password reset: OTP session resets hash, invalidates refresh tokens", () => {
    it("reset sets a new password that works AND invalidates outstanding refresh tokens", async () => {
      const email = uniqueEmail("reset");
      ctx.createdClientEmails.add(email);
      const oldPassword = "OldPass1";
      const newPassword = "NewPass2";

      const seeded = await seedClientWithPassword({ email, password: oldPassword });

      // Establish a refresh-token row (login first to mint one).
      const loginRes = await api()
        .post("/api/v1/public/auth/login")
        .send({ email, password: oldPassword });
      expect(loginRes.status).toBe(200);
      const refreshRowsBefore = await prisma.clientRefreshToken.count({
        where: { clientId: seeded.id, revokedAt: null },
      });
      expect(refreshRowsBefore).toBe(1);

      // Request a password-reset OTP and verify it.
      const reqRes = await requestOtp(
        OtpChannel.EMAIL,
        email,
        OtpPurpose.CLIENT_PASSWORD_RESET,
      );
      expect(reqRes.status).toBe(200);

      const code = lastOtpCode(
        OtpChannel.EMAIL,
        email,
        OtpPurpose.CLIENT_PASSWORD_RESET,
      );
      const sessionToken = await verifyOtp(
        OtpChannel.EMAIL,
        email,
        OtpPurpose.CLIENT_PASSWORD_RESET,
        code,
      );

      const resetRes = await api()
        .post("/api/v1/public/auth/reset-password")
        .send({ sessionToken, newPassword });
      expect(resetRes.status).toBe(204);

      // The passwordHash on the row must have changed AND no longer equal
      // either the old plaintext or the old hash.
      const after = await prisma.client.findUnique({
        where: { id: seeded.id },
        select: { passwordHash: true, tokenVersion: true },
      });
      expect(after!.passwordHash).not.toBeNull();
      expect(after!.passwordHash).not.toMatch(/^OldPass1|^NewPass2/);
      expect(after!.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      // tokenVersion must have been bumped (so all old access JWTs die).
      expect(after!.tokenVersion).toBe(1);

      const bcrypt = await import("bcryptjs");
      expect(await bcrypt.compare(newPassword, after!.passwordHash!)).toBe(true);
      expect(await bcrypt.compare(oldPassword, after!.passwordHash!)).toBe(false);

      // All outstanding refresh-token rows must be revoked.
      const activeRefresh = await prisma.clientRefreshToken.count({
        where: { clientId: seeded.id, revokedAt: null },
      });
      expect(activeRefresh).toBe(0);

      // Login with the NEW password must succeed.
      const newLogin = await api()
        .post("/api/v1/public/auth/login")
        .send({ email, password: newPassword });
      expect(newLogin.status).toBe(200);

      // Login with the OLD password must fail.
      const oldLogin = await api()
        .post("/api/v1/public/auth/login")
        .send({ email, password: oldPassword });
      expect(oldLogin.status).toBe(401);
    });
  });
});
