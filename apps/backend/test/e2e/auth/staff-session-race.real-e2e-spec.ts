/**
 * Staff refresh/logout race — real Postgres regression.
 *
 * The refresh request is paused immediately before replacement persistence.
 * A second valid session logs out while that replacement is paused. Once both
 * requests finish, logout must have revoked every refresh row, including any
 * replacement that was created before the logout transaction acquired its
 * lock. The assertion uses the real database rather than mocked logout state.
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";
import { TokenService } from "../../../src/modules/identity/shared/token.service";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Staff session refresh/logout race — real-DB e2e", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `staff-session-race-${suffix}@sawaa.test`;
  const password = "RacePass1";

  const api = () => request(app.getHttpServer());

  function parseCookies(setCookieHeader: string | string[] | undefined): Record<string, string> {
    if (!setCookieHeader) return {};
    const lines = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const result: Record<string, string> = {};
    for (const line of lines) {
      const [pair] = line.split(";");
      const separator = pair.indexOf("=");
      if (separator < 0) continue;
      result[pair.slice(0, separator)] = pair.slice(separator + 1);
    }
    return result;
  }

  function cookieHeader(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
    if (prisma) {
      await prisma.refreshToken.deleteMany({
        where: { user: { email } },
      }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
    }
    if (app) await app.close();
  });

  it("leaves no active usable replacement after a concurrent logout", async () => {
    const passwordHash = await bcrypt.hash(password, 4);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Staff Race",
        role: "RECEPTIONIST",
        isActive: true,
      },
    });

    const firstLogin = await api()
      .post("/api/v1/auth/login")
      .send({ email, password });
    const secondLogin = await api()
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);

    const firstCookies = parseCookies(firstLogin.headers["set-cookie"]);
    const secondCookies = parseCookies(secondLogin.headers["set-cookie"]);
    expect(firstCookies.ck_refresh).toEqual(expect.any(String));
    expect(secondCookies.ck_refresh).toEqual(expect.any(String));

    let enterReplacement!: () => void;
    let releaseReplacement!: () => void;
    const replacementEntered = new Promise<void>((resolve) => {
      enterReplacement = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseReplacement = resolve;
    });
    const originalIssueTokenPair = TokenService.prototype.issueTokenPair;
    const issueSpy = jest
      .spyOn(TokenService.prototype, "issueTokenPair")
      .mockImplementation(async function (
        this: TokenService,
        ...args: Parameters<TokenService["issueTokenPair"]>
      ) {
        enterReplacement();
        await release;
        return originalIssueTokenPair.apply(this, args);
      });

    try {
      const refreshPromise = api()
        .post("/api/v1/auth/refresh")
        .set("Cookie", cookieHeader(firstCookies))
        .send({})
        .then((response) => response);
      await replacementEntered;

      // Start logout while replacement issuance is held at the real token
      // service. The user row lock in the corrected implementation makes this
      // request wait for refresh's transaction; the legacy implementation can
      // complete revoke-all first and then create a surviving replacement.
      let logoutFinished = false;
      const logoutPromise = api()
        .post("/api/v1/auth/logout")
        .set("Cookie", cookieHeader(secondCookies))
        .send({})
        .then((response) => { logoutFinished = true; return response; });

      // Release only after logout has committed (the legacy bug), or Postgres
      // proves it is waiting on refresh's User lock (the fixed ordering).
      const deadline = Date.now() + 5_000;
      let lockWaiting = false;
      while (!logoutFinished && !lockWaiting && Date.now() < deadline) {
        const rows = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE '%FOR UPDATE%' AND query LIKE '%User%'
          ) AS waiting`;
        lockWaiting = rows[0].waiting;
        if (!logoutFinished && !lockWaiting) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(logoutFinished || lockWaiting).toBe(true);
      releaseReplacement();

      const [refreshResponse, logoutResponse] = await Promise.all([
        refreshPromise,
        logoutPromise,
      ]);
      expect(refreshResponse.status).toBe(200);
      expect(logoutResponse.status).toBe(200);

      const activeRows = await prisma.refreshToken.findMany({
        where: { userId: user.id, revokedAt: null },
      });
      expect(activeRows).toHaveLength(0);

      const after = await prisma.user.findUnique({
        where: { id: user.id },
        select: { tokenVersion: true },
      });
      expect(after!.tokenVersion).toBeGreaterThan(0);
      expect(issueSpy).toHaveBeenCalled();
      const replacementCookies = parseCookies(refreshResponse.headers["set-cookie"]);
      await api().post("/api/v1/auth/refresh")
        .set("Cookie", cookieHeader(replacementCookies)).send({}).expect(401);
      await api().get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${refreshResponse.body.accessToken}`).expect(401);
    } finally {
      releaseReplacement();
      issueSpy.mockRestore();
    }
  });
});
