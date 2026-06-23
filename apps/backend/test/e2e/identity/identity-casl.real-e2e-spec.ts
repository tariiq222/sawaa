/**
 * Identity — Real-DB E2E Spec (CASL allow/deny matrix)
 * =====================================================
 *
 * Exercises the dashboard identity surface against a real Postgres database
 * (no mocked Prisma). External HTTP is intercepted globally by setup-e2e.ts.
 *
 * Bootstrap is intentionally minimal — `Test.createTestingModule({imports:
 * [AppModule]})` — so AppModule's `SystemRolesBootstrap` runs in
 * `onModuleInit` and seeds the canonical CustomRole rows
 * (`systemKey = ADMIN | RECEPTIONIST | ACCOUNTANT | EMPLOYEE`) with their
 * BUILT_IN permissions, exactly as production would. This is the only way
 * `JwtStrategy.validate()` can resolve `systemRolePermissions` from the DB for
 * an EMPLOYEE token, which is the precise CASL surface we are auditing.
 *
 * Two actors:
 *   - adminToken   → User.role = 'ADMIN' / isSuperAdmin = true
 *                    → `manage:User` + `manage:Role` (full CASL access).
 *   - employeeToken → User.role = 'EMPLOYEE' → read:Booking, read:Client,
 *                    update:Booking ONLY — no User/Role permissions at all.
 *
 * The allow/deny matrix is the core of this spec:
 *   ┌─────────────────────┬──────────────────────────┬─────────────────────┐
 *   │ Endpoint            │ ADMIN                    │ EMPLOYEE            │
 *   ├─────────────────────┼──────────────────────────┼─────────────────────┤
 *   │ POST /users         │ 201 + DB row + bcrypt    │ 403, no DB write    │
 *   │ GET  /users         │ 200 + created user       │ 403                 │
 *   │ POST /roles         │ 201 + DB row             │ 403, no DB write    │
 *   │ POST /roles/:id/... │ 204 + DB Permission rows │ n/a                 │
 *   │ PATCH /users/:id/role│ 200 + DB row + tokenV++  │ n/a                 │
 *   │ DELETE /users/:id/  │ 404 when role not        │ n/a                 │
 *   │   roles/:roleId     │   assigned               │                     │
 *   │ (duplicate email)   │ 409 on 2nd create        │ n/a                 │
 *   │ (no token)          │ 401                      │ 401                 │
 *   │ (garbage token)     │ 401                      │ 401                 │
 *   │ (wrong-secret JWT)  │ 401                      │ 401                 │
 *   └─────────────────────┴──────────────────────────┴─────────────────────┘
 *
 * Data isolation: per-run suffix on every email / name. Cleanup is targeted
 * (by suffix) and never touches shared rows.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL="postgresql://sawaa:sawaa_dev_password@localhost:3453/sawaa_test?schema=public&connection_limit=10&pool_timeout=20" \
 *     npx jest --config test/jest-e2e.json --runInBand \
 *     test/e2e/identity/identity-casl.real-e2e-spec.ts
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/infrastructure/database";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Identity — real-DB e2e (CASL allow/deny matrix)", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // ── Per-run isolation ──────────────────────────────────────────────────────
  // The spec runs against a shared sawaa_test DB. Every email / name carries
  // the suffix so cleanup targets only our own writes, and unique constraints
  // (User.email) cannot collide with sibling specs.
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tag = (label: string) => `id-casl-${suffix}-${label}`;
  const uniqueEmail = (label: string) =>
    `identity-casl-${suffix}-${label}@sawaa.test`;

  // Track every entity this spec creates so cleanup is targeted.
  const ctx = {
    adminUserId: "",
    employeeUserId: "",
    createdUserIds: [] as string[],
    createdCustomRoleIds: [] as string[],
    adminToken: "",
    employeeToken: "",
  };

  const api = () => request(app.getHttpServer());
  const withAuth = (token: string) => (req: request.Test) =>
    req.set("Authorization", `Bearer ${token}`);

  // ── Setup / teardown ──────────────────────────────────────────────────────

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
    jwtService = app.get(JwtService);
    await prisma.$queryRaw`SELECT 1`;

    // Cleanup first so reruns against the same suffix are safe (the suffix is
    // time-stamped + random so collisions are vanishingly unlikely, but we do
    // not want stale rows from a half-failed earlier run anyway).
    await cleanup();
    await seedBaseActors();
  });

  afterAll(async () => {
    try {
      await cleanup();
    } catch {
      /* best-effort — see learn-from-mistakes for cleanup resilience */
    }
    if (app) await app.close();
  });

  async function seedBaseActors() {
    // ADMIN actor — role=ADMIN, isSuperAdmin=true → `manage:User` and
    // `manage:Role` (mirrors BUILT_IN.ADMIN from code). Same permission set
    // as OWNER — UserRole enum has no OWNER value.
    const admin = await prisma.user.create({
      data: {
        email: uniqueEmail("admin"),
        passwordHash: "not-used",
        name: tag("Admin"),
        role: "ADMIN",
        isSuperAdmin: true,
        isActive: true,
      },
    });
    ctx.adminUserId = admin.id;
    ctx.adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      isSuperAdmin: true,
    });

    // EMPLOYEE actor — role=EMPLOYEE → read:Booking, read:Client,
    // update:Booking ONLY (mirrors BUILT_IN.EMPLOYEE — no User/Role perms).
    const employeeUser = await prisma.user.create({
      data: {
        email: uniqueEmail("employee"),
        passwordHash: "not-used",
        name: tag("Employee"),
        role: "EMPLOYEE",
        isSuperAdmin: false,
        isActive: true,
      },
    });
    ctx.employeeUserId = employeeUser.id;
    ctx.employeeToken = jwtService.sign({
      sub: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      isSuperAdmin: false,
    });
  }

  /**
   * Targeted cleanup of only this spec's rows. User.customRoleId → CustomRole
   * is `NoAction`, so we have to delete Users first; Permission rows cascade
   * when their parent CustomRole is removed.
   */
  async function cleanup() {
    if (!prisma) return;

    await prisma.user
      .deleteMany({
        where: { email: { startsWith: `identity-casl-${suffix}-` } },
      })
      .catch(() => undefined);

    await prisma.customRole
      .deleteMany({
        where: { name: { startsWith: tag("") } },
      })
      .catch(() => undefined);

    ctx.createdUserIds = [];
    ctx.createdCustomRoleIds = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASL ALLOW — ADMIN token has manage:User and manage:Role
  // ═══════════════════════════════════════════════════════════════════════════

  describe("CASL allow: ADMIN can create / list users and roles", () => {
    it("creates a RECEPTIONIST user (201) and the DB row exists with a bcrypt passwordHash", async () => {
      const email = uniqueEmail("create-user");

      const res = await withAuth(ctx.adminToken)(
        api().post("/api/v1/dashboard/identity/users"),
      ).send({
        email,
        password: "InitialPass1",
        name: tag("CreatedUser"),
        role: "RECEPTIONIST",
      });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe(email);
      expect(res.body.role).toBe("RECEPTIONIST");
      expect(res.body.isActive).toBe(true);
      ctx.createdUserIds.push(res.body.id);

      // Re-read from DB to prove the write actually landed — and to verify the
      // password was bcrypt-hashed, never stored in plaintext (P0-1 invariant).
      const row = await prisma.user.findUnique({ where: { id: res.body.id } });
      expect(row).not.toBeNull();
      expect(row!.email).toBe(email);
      expect(row!.role).toBe("RECEPTIONIST");
      expect(row!.isActive).toBe(true);
      expect(row!.passwordHash).not.toBe("InitialPass1");
      expect(row!.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);

      // Response body must NOT leak the passwordHash — the handler uses
      // `omit: { passwordHash: true }`.
      expect(res.body.passwordHash).toBeUndefined();
    });

    it("lists users (200) and returns the just-created one", async () => {
      // Create a fresh target inside this test so the assertion is self-contained.
      const email = uniqueEmail("list-target");
      const create = await withAuth(ctx.adminToken)(
        api().post("/api/v1/dashboard/identity/users"),
      ).send({
        email,
        password: "InitialPass1",
        name: tag("ListTarget"),
        role: "EMPLOYEE",
      });
      expect(create.status).toBe(201);
      ctx.createdUserIds.push(create.body.id);

      const res = await withAuth(ctx.adminToken)(
        api().get("/api/v1/dashboard/identity/users"),
      ).query({ search: tag("ListTarget"), limit: 50 });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      const found = res.body.items.find(
        (u: { id: string }) => u.id === create.body.id,
      );
      expect(found).toBeDefined();
      expect(found.email).toBe(email);
      expect(found.role).toBe("EMPLOYEE");
      expect(res.body.meta).toBeDefined();
      expect(typeof res.body.meta.total).toBe("number");
    });

    it("creates a custom role (201) with empty permissions, then assigns permissions (204)", async () => {
      const roleRes = await withAuth(ctx.adminToken)(
        api().post("/api/v1/dashboard/identity/roles"),
      ).send({ name: tag("RoleWithPerms") });

      expect(roleRes.status).toBe(201);
      expect(roleRes.body.name).toBe(tag("RoleWithPerms"));
      expect(roleRes.body.isSystem).toBe(false);
      ctx.createdCustomRoleIds.push(roleRes.body.id);

      // New custom role has no permissions.
      const fresh = await prisma.customRole.findUnique({
        where: { id: roleRes.body.id },
        include: { permissions: true },
      });
      expect(fresh!.permissions).toEqual([]);

      // Assign two permissions — must replace atomically (handler deletes
      // existing rows before inserting the new set).
      const permsRes = await withAuth(ctx.adminToken)(
        api().post(
          `/api/v1/dashboard/identity/roles/${roleRes.body.id}/permissions`,
        ),
      ).send({
        permissions: [
          { action: "read", subject: "Booking" },
          { action: "create", subject: "Booking" },
        ],
      });
      expect(permsRes.status).toBe(204);

      const perms = await prisma.permission.findMany({
        where: { customRoleId: roleRes.body.id },
        orderBy: [{ action: "asc" }, { subject: "asc" }],
      });
      expect(perms).toHaveLength(2);
      expect(perms.map((p) => p.action)).toEqual(["create", "read"]);
      expect(perms.map((p) => p.subject)).toEqual(["Booking", "Booking"]);
    });

    it("changes a user's role (200), DB row reflects new role and tokenVersion is bumped", async () => {
      // Create the target directly in the DB so this test owns every row it
      // depends on. Start at EMPLOYEE (rank 30) — well below RECEPTIONIST
      // (rank 40) so the rank gate in UpdateUserRoleHandler passes.
      const target = await prisma.user.create({
        data: {
          email: uniqueEmail("role-change-target"),
          passwordHash: "not-used",
          name: tag("RoleChangeTarget"),
          role: "EMPLOYEE",
          isActive: true,
        },
      });
      ctx.createdUserIds.push(target.id);
      expect(target.tokenVersion).toBe(0);

      const res = await withAuth(ctx.adminToken)(
        api().patch(`/api/v1/dashboard/identity/users/${target.id}/role`),
      ).send({ role: "RECEPTIONIST" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("RECEPTIONIST");
      expect(res.body.id).toBe(target.id);

      // DB row reflects the new role + tokenVersion bumped (so outstanding
      // access JWTs are invalidated on next use — required by the security
      // comment in update-user-role.handler.ts).
      const after = await prisma.user.findUnique({
        where: { id: target.id },
        select: { role: true, tokenVersion: true },
      });
      expect(after!.role).toBe("RECEPTIONIST");
      expect(after!.tokenVersion).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CASL DENY — EMPLOYEE token has zero User / Role permissions
  // ═══════════════════════════════════════════════════════════════════════════

  describe("CASL deny: EMPLOYEE is forbidden from every User/Role endpoint (403)", () => {
    it("is forbidden from creating a user (403) — and no DB row was created", async () => {
      const email = uniqueEmail("emp-create");

      const res = await withAuth(ctx.employeeToken)(
        api().post("/api/v1/dashboard/identity/users"),
      ).send({
        email,
        password: "InitialPass1",
        name: tag("EmpCreate"),
        role: "RECEPTIONIST",
      });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/insufficient|forbidden/i);

      // No DB write — CaslGuard rejects BEFORE the handler runs.
      const rows = await prisma.user.findMany({ where: { email } });
      expect(rows).toHaveLength(0);
    });

    it("is forbidden from listing users (403)", async () => {
      const res = await withAuth(ctx.employeeToken)(
        api().get("/api/v1/dashboard/identity/users"),
      );

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/insufficient|forbidden/i);
    });

    it("is forbidden from creating a role (403) — and no DB row was created", async () => {
      const roleName = tag("EmpRole");

      const res = await withAuth(ctx.employeeToken)(
        api().post("/api/v1/dashboard/identity/roles"),
      ).send({ name: roleName });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/insufficient|forbidden/i);

      // No DB write — same CaslGuard rejection path.
      const rows = await prisma.customRole.findMany({ where: { name: roleName } });
      expect(rows).toHaveLength(0);
    });

    it("is forbidden from listing permissions (403)", async () => {
      const res = await withAuth(ctx.employeeToken)(
        api().get("/api/v1/dashboard/identity/permissions"),
      );

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/insufficient|forbidden/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JWT AUTHN — missing / invalid / wrong-secret tokens all rejected (401)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("JWT authn: invalid tokens are rejected with 401", () => {
    it("rejects requests with no Authorization header", async () => {
      const res = await api().get("/api/v1/dashboard/identity/users");
      expect(res.status).toBe(401);
    });

    it("rejects requests with a garbage Bearer token (not a JWT at all)", async () => {
      const res = await api()
        .get("/api/v1/dashboard/identity/users")
        .set("Authorization", "Bearer not-a-jwt-at-all");
      expect(res.status).toBe(401);
    });

    it("rejects a JWT signed with the wrong secret", async () => {
      // Sign a token with a totally different secret. JwtStrategy verifies
      // against JWT_ACCESS_SECRET (the test-e2e value from setup-e2e.ts) so
      // signature mismatch MUST throw UnauthorizedException → 401.
      const forged = jwtService.sign(
        {
          sub: ctx.adminUserId,
          email: "admin@sawaa.test",
          role: "ADMIN",
          isSuperAdmin: true,
        },
        { secret: "wrong-secret-not-the-real-one-zzz" },
      );

      const res = await api()
        .get("/api/v1/dashboard/identity/users")
        .set("Authorization", `Bearer ${forged}`);
      expect(res.status).toBe(401);
    });

    it("rejects a JWT whose `sub` points at a user that does not exist", async () => {
      // Valid signature, valid claims — but the strategy calls
      // prisma.user.findUnique({where: {id: payload.sub}}) which returns null
      // and the strategy throws UnauthorizedException.
      const ghost = jwtService.sign({
        sub: "00000000-0000-0000-0000-000000000000",
        email: "ghost@sawaa.test",
        role: "ADMIN",
        isSuperAdmin: true,
      });
      const res = await api()
        .get("/api/v1/dashboard/identity/users")
        .set("Authorization", `Bearer ${ghost}`);
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAILURE PATHS — handler-level rejections (post-CaslGuard)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Failure paths: duplicate email + remove-role for unassigned roleId", () => {
    it("rejects a second create-user with the same email (409 Conflict)", async () => {
      const email = uniqueEmail("dup-email");

      const first = await withAuth(ctx.adminToken)(
        api().post("/api/v1/dashboard/identity/users"),
      ).send({
        email,
        password: "InitialPass1",
        name: tag("DupFirst"),
        role: "RECEPTIONIST",
      });
      expect(first.status).toBe(201);
      ctx.createdUserIds.push(first.body.id);

      const second = await withAuth(ctx.adminToken)(
        api().post("/api/v1/dashboard/identity/users"),
      ).send({
        email,
        password: "AnotherPass1",
        name: tag("DupSecond"),
        role: "RECEPTIONIST",
      });

      expect(second.status).toBe(409);
      expect(second.body.message).toMatch(/already registered|email/i);

      // Exactly ONE row exists for this email — the second attempt must not
      // have mutated the first row either (name still "DupFirst").
      const rows = await prisma.user.findMany({ where: { email } });
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe(tag("DupFirst"));
    });

    it("rejects remove-role when the roleId is not assigned to the user (404)", async () => {
      // Create a target user that has NO customRoleId assigned.
      const target = await prisma.user.create({
        data: {
          email: uniqueEmail("remove-role-target"),
          passwordHash: "not-used",
          name: tag("RemoveRoleTarget"),
          role: "EMPLOYEE",
          isActive: true,
        },
      });
      ctx.createdUserIds.push(target.id);

      // ParseUUIDPipe on :roleId requires a syntactically valid UUID but the
      // role does not have to exist in the DB — the handler itself looks up
      // User.updateMany({where:{id,customRoleId:thatUuid}}) which returns
      // count=0, and RemoveRoleHandler throws NotFoundException for that.
      const unassignedRoleId = "11111111-1111-4111-8111-111111111111";

      const res = await withAuth(ctx.adminToken)(
        api().delete(
          `/api/v1/dashboard/identity/users/${target.id}/roles/${unassignedRoleId}`,
        ),
      );

      expect(res.status).toBe(404);

      // The user must still have customRoleId = null.
      const after = await prisma.user.findUnique({
        where: { id: target.id },
        select: { customRoleId: true },
      });
      expect(after!.customRoleId).toBeNull();
    });
  });
});
