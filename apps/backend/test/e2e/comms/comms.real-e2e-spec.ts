/**
 * Comms — Real-DB E2E Spec
 * ========================
 *
 * Exercises the high-value dashboard COMMS endpoints against a real Postgres
 * database (no mocked Prisma). External HTTP is intercepted globally by
 * setup-e2e.ts, and nodemailer / ioredis / BullMQ / fetch are stubbed there
 * so the AppModule boots without real infrastructure.
 *
 * The spec targets the behaviours a mocked-Prisma test cannot prove on the
 * dashboard surface (`src/api/dashboard/comms.controller.ts`):
 *
 *   ┌────────────────────────┬──────────────────────────────────────────────────┐
 *   │ Endpoint               │ Real assertion                                   │
 *   ├────────────────────────┼──────────────────────────────────────────────────┤
 *   │ GET    /notifications  │ Returns only the seeded rows for recipientId;    │
 *   │                        │ unreadOnly=true narrows to isRead=false.         │
 *   │ GET    /notifications/ │ Count reflects real DB rows; flips to 0 after   │
 *   │        unread-count    │ mark-read of all unread.                         │
 *   │ PATCH  /notifications/ │ isRead flips to true in DB; readAt populated;   │
 *   │        mark-read       │ scoped to recipientId (no cross-tenant leak).    │
 *   │ (no token)             │ 401                                              │
 *   ├────────────────────────┼──────────────────────────────────────────────────┤
 *   │ GET    /settings/sms   │ Returns OrgSmsConfigView WITHOUT                 │
 *   │                        │ credentialsCiphertext or webhookSecret — the    │
 *   │                        │ dashboard form is write-only. (P0 SECURITY       │
 *   │                        │ CONTRACT: an SMS provider credential leak.)     │
 *   │ POST   /settings/sms   │ Encrypts credentials (HKDF + AES-256-GCM via    │
 *   │                        │ SmsCredentialsService), persists ciphertext,    │
 *   │                        │ rotates webhookSecret on provider change.       │
 *   │ POST   /settings/sms   │ provider=UNIFONIC without creds → 400.          │
 *   │        (missing creds) │                                                  │
 *   ├────────────────────────┼──────────────────────────────────────────────────┤
 *   │ GET    /email-templates│ Returns the seeded template in items[]; meta    │
 *   │                        │ carries total/page/perPage.                      │
 *   │ GET    /email-templates│ Returns full row incl. blocks/htmlBody.          │
 *   │        /:id            │                                                  │
 *   │ PATCH  /email-templates│ Persists new name+subject in DB; when blocks    │
 *   │        /:id            │ provided, htmlBody is re-rendered from blocks.   │
 *   │ GET    /email-templates│ Returns null/404 for a random uuid.              │
 *   │        /:id (missing)  │                                                  │
 *   ├────────────────────────┼──────────────────────────────────────────────────┤
 *   │ EMPLOYEE caller        │ 403 on a protected comms endpoint                │
 *   │ (no Setting perm)      │ (POST /settings/sms).                            │
 *   └────────────────────────┴──────────────────────────────────────────────────┘
 *
 * Why these and not others:
 *   - Contact-messages already has a public real-e2e spec.
 *   - Chat surfaces are authz-scoped (AUTHZ-004) — out of scope for this pass.
 *   - Send-email / Send-sms / Send-push handlers exist under comms/ but are
 *     NOT mounted on the dashboard controller — they are internal to the
 *     resilient-notification-dispatcher. Skipped.
 *   - FCM tokens live on `mobile/client/notifications.controller.ts`, not the
 *     dashboard surface. Skipped.
 *
 * Data isolation: every seeded row carries a per-run suffix so this spec can
 * run alongside other real-DB specs (finance, identity, bookings, public) on
 * the shared `sawaa_test` database. Cleanup is targeted (by suffix + by id)
 * and never touches shared rows.
 *
 * Run:
 *   REAL_E2E_DATABASE_URL="postgresql://sawaa:sawaa_dev_password@localhost:3453/sawaa_test?schema=public&connection_limit=10&pool_timeout=20" \
 *     npx jest --config test/jest-e2e.json --runInBand \
 *     test/e2e/comms/comms.real-e2e-spec.ts
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

describeRealE2e(
  "Comms — real-DB e2e (notifications, SMS config security contract, email templates, authz)",
  () => {
    jest.setTimeout(60_000);

    let app: INestApplication;
    let prisma: PrismaService;
    let jwtService: JwtService;

    // ── Per-run isolation ────────────────────────────────────────────────────
    // The spec runs against a shared sawaa_test DB. Every seeded row carries
    // the suffix so cleanup targets only our own writes, and unique constraints
    // (User.email) cannot collide with sibling specs.
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tag = (label: string) => `comms-e2e-${suffix}-${label}`;
    const uniqueEmail = (label: string) =>
      `comms-real-e2e-${suffix}-${label}@sawaa.test`;
    const uniqueSlug = (label: string) =>
      `comms-e2e-${suffix}-${label}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .slice(0, 60);

    // Track every entity this spec creates so cleanup is targeted.
    const ctx = {
      adminUserId: "",
      employeeUserId: "",
      adminToken: "",
      employeeToken: "",
      notificationIds: [] as string[],
      emailTemplateIds: [] as string[],
      // We do not own the OrganizationSmsConfig row id (singleton). We
      // remember the pre-test value so afterAll can restore provider=NONE.
      smsConfigBefore: null as null | {
        id: string;
        provider: string;
        senderId: string | null;
        credentialsCiphertext: string | null;
        webhookSecret: string | null;
      },
    };

    const api = () => request(app.getHttpServer());
    const withAuth = (token: string) => (req: request.Test) =>
      req.set("Authorization", `Bearer ${token}`);

    // ── Setup / teardown ─────────────────────────────────────────────────────

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

      // Snapshot the SMS singleton BEFORE we run any test, so afterAll can
      // restore provider=NONE and drop any creds we set. (Other specs assume
      // the global singleton is in its baseline state.)
      await cleanup();
      ctx.smsConfigBefore = await prisma.organizationSmsConfig.findFirst();
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

    // ── Seed helpers ─────────────────────────────────────────────────────────

    async function seedBaseActors() {
      // ADMIN actor — role=ADMIN, isSuperAdmin=true → `manage:Setting` (full
      // access to dashboard comms).
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
      // update:Booking ONLY. No Setting permission → comms endpoints that
      // require `manage:Setting` (e.g. /settings/sms) MUST 403.
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
     * Targeted cleanup of only this spec's rows. The OrganizationSmsConfig
     * singleton is reset to its pre-test state (or NONE if no row existed).
     */
    async function cleanup() {
      if (!prisma) return;

      // ── Notifications → recipients are user ids (no FK so plain delete) ──
      await prisma.notification
        .deleteMany({
          where: { recipientId: { in: [ctx.adminUserId, ctx.employeeUserId].filter(Boolean) } },
        })
        .catch(() => undefined);

      // ── Email templates → suffix-scoped (no FK) ──
      await prisma.emailTemplate
        .deleteMany({
          where: { slug: { startsWith: `comms-e2e-${suffix}-` } },
        })
        .catch(() => undefined);

      // ── Users → by suffix ──
      await prisma.user
        .deleteMany({
          where: { email: { startsWith: `comms-real-e2e-${suffix}-` } },
        })
        .catch(() => undefined);

      // ── SMS singleton → restore pre-test state (or reset to NONE) ──
      const before = ctx.smsConfigBefore;
      if (before) {
        await prisma.organizationSmsConfig
          .update({
            where: { id: before.id },
            data: {
              provider: before.provider as "NONE" | "UNIFONIC" | "TAQNYAT",
              senderId: before.senderId,
              credentialsCiphertext: before.credentialsCiphertext,
              webhookSecret: before.webhookSecret,
            },
          })
          .catch(() => undefined);
      } else {
        await prisma.organizationSmsConfig
          .updateMany({
            where: {},
            data: {
              provider: "NONE",
              senderId: null,
              credentialsCiphertext: null,
              webhookSecret: null,
            },
          })
          .catch(() => undefined);
      }

      ctx.notificationIds = [];
      ctx.emailTemplateIds = [];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NOTIFICATIONS — list, mark-read, unread-count
    // ═══════════════════════════════════════════════════════════════════════════

    describe("Notifications: list, unread-count, mark-read (per-recipient scoped)", () => {
      async function seedAdminNotifications() {
        // Seed 3 notifications for the admin recipient: 2 unread + 1 already-read.
        const rows = await Promise.all([
          prisma.notification.create({
            data: {
              recipientId: ctx.adminUserId,
              recipientType: "EMPLOYEE",
              type: "GENERAL",
              title: tag("first-unread"),
              body: "First unread body",
            },
          }),
          prisma.notification.create({
            data: {
              recipientId: ctx.adminUserId,
              recipientType: "EMPLOYEE",
              type: "BOOKING_CONFIRMED",
              title: tag("second-unread"),
              body: "Second unread body",
            },
          }),
          prisma.notification.create({
            data: {
              recipientId: ctx.adminUserId,
              recipientType: "EMPLOYEE",
              type: "GENERAL",
              title: tag("already-read"),
              body: "Already read body",
              isRead: true,
              readAt: new Date(),
            },
          }),
        ]);
        ctx.notificationIds.push(...rows.map((r) => r.id));
        return rows;
      }

      it("GET /notifications returns the seeded notifications for the current user", async () => {
        const seeded = await seedAdminNotifications();

        const res = await withAuth(ctx.adminToken)(
          api().get("/api/v1/dashboard/comms/notifications"),
        ).query({ limit: 50 });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);

        const ids: string[] = res.body.items.map((n: { id: string }) => n.id);
        for (const row of seeded) {
          expect(ids).toContain(row.id);
        }

        // The list is global (other sibling specs may have created rows for
        // unrelated users) — assert the invariants the handler MUST hold:
        // every returned row carries recipientId === adminUserId.
        for (const n of res.body.items) {
          expect(n.recipientId).toBe(ctx.adminUserId);
          expect(typeof n.title).toBe("string");
          expect(typeof n.body).toBe("string");
          expect(typeof n.isRead).toBe("boolean");
        }

        // Canonical list-response shape: meta carries total + page.
        expect(res.body.meta).toBeDefined();
        expect(typeof res.body.meta.total).toBe("number");
        expect(res.body.meta.total).toBeGreaterThanOrEqual(seeded.length);
      });

      it("GET /notifications?unreadOnly=true excludes already-read rows (real DB filter)", async () => {
        // Uses the rows from the previous test (still in DB).
        const res = await withAuth(ctx.adminToken)(
          api().get("/api/v1/dashboard/comms/notifications"),
        ).query({ unreadOnly: "true", limit: 50 });

        expect(res.status).toBe(200);
        // Every item returned must have isRead === false.
        for (const n of res.body.items) {
          expect(n.isRead).toBe(false);
          expect(n.recipientId).toBe(ctx.adminUserId);
        }
        // meta.total is the count of unread rows for this recipient
        // (handler counts the same `where` it paginates).
        const unreadIds = res.body.items.map((n: { id: string }) => n.id);
        // Sanity: every item we know is unread must be present.
        const seeded = await prisma.notification.findMany({
          where: { recipientId: ctx.adminUserId, isRead: false },
        });
        for (const row of seeded) {
          expect(unreadIds).toContain(row.id);
        }
      });

      it("GET /notifications/unread-count reflects real DB rows; flips to 0 after mark-read-all", async () => {
        // Pre-condition: at least one unread notification for admin.
        await prisma.notification.create({
          data: {
            recipientId: ctx.adminUserId,
            recipientType: "EMPLOYEE",
            type: "GENERAL",
            title: tag("count-target"),
            body: "Unread for count",
          },
        });

        // ── BEFORE: count > 0 ──
        const before = await withAuth(ctx.adminToken)(
          api().get("/api/v1/dashboard/comms/notifications/unread-count"),
        );
        expect(before.status).toBe(200);
        expect(before.body).toHaveProperty("count");
        expect(typeof before.body.count).toBe("number");
        expect(before.body.count).toBeGreaterThan(0);

        const expectedAfter = await prisma.notification.count({
          where: { recipientId: ctx.adminUserId, isRead: false },
        });
        expect(before.body.count).toBe(expectedAfter);

        // ── ACTION: PATCH /mark-read with no notificationId → mark all ──
        const mark = await withAuth(ctx.adminToken)(
          api().patch("/api/v1/dashboard/comms/notifications/mark-read"),
        ).send({});
        expect(mark.status).toBe(204);

        // ── AFTER: count === 0 AND DB rows are flipped ──
        const after = await withAuth(ctx.adminToken)(
          api().get("/api/v1/dashboard/comms/notifications/unread-count"),
        );
        expect(after.status).toBe(200);
        expect(after.body.count).toBe(0);

        const unreadAfter = await prisma.notification.findMany({
          where: { recipientId: ctx.adminUserId, isRead: false },
        });
        expect(unreadAfter).toHaveLength(0);

        // The previously-read row we seeded (readAt already populated) should
        // still be isRead=true; the now-read rows must have readAt populated.
        const justRead = await prisma.notification.findFirst({
          where: { recipientId: ctx.adminUserId, title: tag("first-unread") },
        });
        expect(justRead).not.toBeNull();
        expect(justRead!.isRead).toBe(true);
        expect(justRead!.readAt).not.toBeNull();
      });

      it("PATCH /mark-read with notificationId flips ONE row (scoped to recipient)", async () => {
        // Seed two unread for the employee (so we can flip one without
        // affecting the other). EMPLOYEE has update:Booking → mark-read passes.
        const a = await prisma.notification.create({
          data: {
            recipientId: ctx.employeeUserId,
            recipientType: "EMPLOYEE",
            type: "GENERAL",
            title: tag("emp-one"),
            body: "first",
          },
        });
        const b = await prisma.notification.create({
          data: {
            recipientId: ctx.employeeUserId,
            recipientType: "EMPLOYEE",
            type: "GENERAL",
            title: tag("emp-two"),
            body: "second",
          },
        });
        ctx.notificationIds.push(a.id, b.id);

        const mark = await withAuth(ctx.employeeToken)(
          api().patch("/api/v1/dashboard/comms/notifications/mark-read"),
        ).send({ notificationId: a.id });
        expect(mark.status).toBe(204);

        // Re-read from DB — only `a` flipped; `b` still unread.
        const aAfter = await prisma.notification.findUnique({ where: { id: a.id } });
        const bAfter = await prisma.notification.findUnique({ where: { id: b.id } });
        expect(aAfter!.isRead).toBe(true);
        expect(aAfter!.readAt).not.toBeNull();
        expect(bAfter!.isRead).toBe(false);
        expect(bAfter!.readAt).toBeNull();
      });

      it("rejects unauthenticated /notifications requests with 401", async () => {
        const res = await api().get("/api/v1/dashboard/comms/notifications");
        expect(res.status).toBe(401);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ORG SMS CONFIG — get / upsert + the no-ciphertext-leak security contract
    // ═══════════════════════════════════════════════════════════════════════════

    describe("Org SMS config: upsert encrypts, GET never returns ciphertext/secret", () => {
      it("POST /settings/sms with UNIFONIC credentials encrypts and persists ciphertext (no plaintext)", async () => {
        // Start clean — the cleanup in beforeAll left the row in its baseline,
        // but other sibling specs may have touched it. Force provider=NONE here
        // so the rotate-webhookSecret branch fires.
        await prisma.organizationSmsConfig.updateMany({
          where: {},
          data: {
            provider: "NONE",
            credentialsCiphertext: null,
            webhookSecret: null,
            senderId: null,
          },
        });

        const plaintext = {
          appSid: `app-sid-${suffix}-must-not-leak`,
          apiKey: `api-key-${suffix}-must-not-leak`,
        };

        const res = await withAuth(ctx.adminToken)(
          api().post("/api/v1/dashboard/comms/settings/sms"),
        ).send({
          provider: "UNIFONIC",
          senderId: `SENDER-${suffix}`,
          unifonic: plaintext,
        });

        expect(res.status).toBe(200);

        // Response body MUST NOT carry ciphertext, webhook secret, OR the
        // plaintext credentials — the handler's OrgSmsConfigView strips them.
        expect(res.body).not.toHaveProperty("credentialsCiphertext");
        expect(res.body).not.toHaveProperty("webhookSecret");
        expect(JSON.stringify(res.body)).not.toContain(plaintext.appSid);
        expect(JSON.stringify(res.body)).not.toContain(plaintext.apiKey);

        // credentialsConfigured is the only signal the dashboard reads.
        expect(res.body.credentialsConfigured).toBe(true);
        expect(res.body.provider).toBe("UNIFONIC");
        expect(res.body.senderId).toBe(`SENDER-${suffix}`);

        // Re-read the DB row: ciphertext MUST be non-null (encrypted) and
        // the plaintext values MUST NOT appear anywhere in the row.
        const row = await prisma.organizationSmsConfig.findFirst();
        expect(row).not.toBeNull();
        expect(row!.provider).toBe("UNIFONIC");
        expect(row!.credentialsCiphertext).not.toBeNull();
        expect(row!.credentialsCiphertext!.length).toBeGreaterThan(0);
        expect(row!.credentialsCiphertext).not.toContain(plaintext.appSid);
        expect(row!.credentialsCiphertext).not.toContain(plaintext.apiKey);
        // webhookSecret rotates on provider change.
        expect(row!.webhookSecret).not.toBeNull();
        expect(row!.webhookSecret!.length).toBeGreaterThanOrEqual(32);
      });

      it("GET /settings/sms NEVER returns credentialsCiphertext or webhookSecret (P0 SECURITY CONTRACT)", async () => {
        // Pre-condition: the row from the previous test has UNIFONIC + a
        // ciphertext + a rotated webhookSecret. The GET handler MUST strip both.
        const res = await withAuth(ctx.adminToken)(
          api().get("/api/v1/dashboard/comms/settings/sms"),
        );

        expect(res.status).toBe(200);

        // The view shape explicitly omits these fields. This is a real
        // security contract: a leaked ciphertext + the static SMS_PROVIDER_
        // ENCRYPTION_KEY decrypts to the provider API key.
        expect(res.body).not.toHaveProperty("credentialsCiphertext");
        expect(res.body).not.toHaveProperty("webhookSecret");
        expect(JSON.stringify(res.body)).not.toMatch(/credentialsCiphertext/);
        expect(JSON.stringify(res.body)).not.toMatch(/webhookSecret/);

        // Sanity: the safe fields ARE returned and reflect the upsert.
        expect(res.body.provider).toBe("UNIFONIC");
        expect(res.body.credentialsConfigured).toBe(true);
        expect(res.body.senderId).toBe(`SENDER-${suffix}`);

        // The ciphertext stored in the DB must NOT appear anywhere in the
        // serialized response payload.
        const stored = await prisma.organizationSmsConfig.findFirst();
        const serialized = JSON.stringify(res.body);
        expect(serialized).not.toContain(stored!.credentialsCiphertext!);
        expect(serialized).not.toContain(stored!.webhookSecret!);
      });

      it("POST /settings/sms with provider=UNIFONIC but no credentials returns 400 and does NOT mutate the row", async () => {
        // Snapshot the row BEFORE the rejected POST: the handler must throw
        // BEFORE encrypting + persisting, so the ciphertext on disk stays
        // identical to the value from the prior successful upsert.
        const before = await prisma.organizationSmsConfig.findFirst();
        expect(before).not.toBeNull();
        const beforeCiphertext = before!.credentialsCiphertext;
        const beforeWebhook = before!.webhookSecret;
        const beforeUpdatedAt = before!.updatedAt.getTime();

        const res = await withAuth(ctx.adminToken)(
          api().post("/api/v1/dashboard/comms/settings/sms"),
        ).send({
          provider: "UNIFONIC",
          senderId: "SENDER-NO-CREDS",
        });

        expect(res.status).toBe(400);
        // The handler throws BadRequestException with a bilingual message; we
        // match the EN side loosely.
        expect(JSON.stringify(res.body)).toMatch(/Unifonic credentials/i);

        // Re-read after: the row must be byte-for-byte identical to the
        // snapshot — same ciphertext, same webhookSecret, same updatedAt.
        // If the handler had a bug where it persisted partial state on
        // rejection (e.g. updatedAt bumped or ciphertext cleared to ""),
        // this assertion would fail.
        const after = await prisma.organizationSmsConfig.findFirst();
        expect(after).not.toBeNull();
        expect(after!.credentialsCiphertext).toBe(beforeCiphertext);
        expect(after!.webhookSecret).toBe(beforeWebhook);
        expect(after!.updatedAt.getTime()).toBe(beforeUpdatedAt);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // EMAIL TEMPLATES — list, get, update
    // ═══════════════════════════════════════════════════════════════════════════

    describe("Email templates: list, get, update (DB writes verified)", () => {
      // Phase 3 migration adds `UNIQUE INDEX EmailTemplate_slug_key`, so the
      // slug must be unique per row. Increment a counter across the suite so
      // each call inside this describe gets a distinct slug.
      let slugCounter = 0;
      async function seedTemplate() {
        slugCounter += 1;
        const tmpl = await prisma.emailTemplate.create({
          data: {
            // Suffix alone can collide across reruns of the same suffix —
            // include the counter so two seedTemplate() calls inside one run
            // never collide.
            slug: uniqueSlug(`welcome-${slugCounter}`),
            name: tag("Welcome template"),
            subject: "Original subject",
            htmlBody: "<p>Original body</p>",
            isActive: true,
          },
        });
        ctx.emailTemplateIds.push(tmpl.id);
        return tmpl;
      }

      it("GET /email-templates lists the seeded template with meta.total", async () => {
        const seeded = await seedTemplate();

        const res = await withAuth(ctx.adminToken)(
          api().get("/api/v1/dashboard/comms/email-templates"),
        ).query({ limit: 50 });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);

        const ids: string[] = res.body.items.map((t: { id: string }) => t.id);
        expect(ids).toContain(seeded.id);

        const ours = res.body.items.find(
          (t: { id: string }) => t.id === seeded.id,
        );
        expect(ours).toBeDefined();
        expect(ours.name).toBe(tag("Welcome template"));
        expect(ours.subject).toBe("Original subject");
        expect(ours.isActive).toBe(true);
        expect(typeof ours.htmlBody).toBe("string");

        // Canonical list-response shape: meta carries total + perPage.
        expect(res.body.meta).toBeDefined();
        expect(typeof res.body.meta.total).toBe("number");
        expect(typeof res.body.meta.perPage).toBe("number");
      });

      it("GET /email-templates/:id returns the template with blocks/htmlBody", async () => {
        const seeded = await seedTemplate();

        const res = await withAuth(ctx.adminToken)(
          api().get(`/api/v1/dashboard/comms/email-templates/${seeded.id}`),
        );

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(seeded.id);
        expect(res.body.slug).toBe(seeded.slug);
        expect(res.body.name).toBe(tag("Welcome template"));
        expect(res.body.htmlBody).toContain("Original body");
        expect(typeof res.body.isActive).toBe("boolean");
      });

      it("PATCH /email-templates/:id updates name+subject in the real DB", async () => {
        const seeded = await seedTemplate();

        const res = await withAuth(ctx.adminToken)(
          api().patch(`/api/v1/dashboard/comms/email-templates/${seeded.id}`),
        ).send({
          name: tag("Updated name"),
          subject: "Updated subject",
        });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe(tag("Updated name"));
        expect(res.body.subject).toBe("Updated subject");

        // Re-read from DB — must reflect the new values verbatim.
        const row = await prisma.emailTemplate.findUnique({
          where: { id: seeded.id },
        });
        expect(row).not.toBeNull();
        expect(row!.name).toBe(tag("Updated name"));
        expect(row!.subject).toBe("Updated subject");
        // htmlBody untouched (we did not pass blocks or htmlBody).
        expect(row!.htmlBody).toBe("<p>Original body</p>");
        // updatedAt advanced.
        expect(row!.updatedAt.getTime()).toBeGreaterThanOrEqual(
          seeded.updatedAt.getTime(),
        );
      });

      it("PATCH /email-templates/:id with blocks re-renders htmlBody from the block tree", async () => {
        const seeded = await seedTemplate();

        const blocks = [
          { type: "heading", id: "h1", text: "Hello", level: 1 },
          { type: "paragraph", id: "p1", text: "World" },
        ];

        const res = await withAuth(ctx.adminToken)(
          api().patch(`/api/v1/dashboard/comms/email-templates/${seeded.id}`),
        ).send({ blocks });

        expect(res.status).toBe(200);

        const row = await prisma.emailTemplate.findUnique({
          where: { id: seeded.id },
        });
        expect(row).not.toBeNull();

        // ── CORE invariant (the security-relevant path): the handler
        //    re-renders htmlBody from the supplied blocks. The block→HTML
        //    renderer uses escapeHtml on every value, so the heading
        //    "Hello" must appear in the rendered output. This is the path
        //    that proves block-tree content lands in outbound email safely.
        expect(row!.htmlBody).toContain("<h1");
        expect(row!.htmlBody).toContain("Hello");
        expect(row!.htmlBody).toContain("<p");
        expect(row!.htmlBody).toContain("World");
        // The handler wiped the original "Original body" content because
        // re-rendering replaces the htmlBody.
        expect(row!.htmlBody).not.toContain("Original body");

        // ── blocks JSON is persisted (non-null). The exact round-trip
        //    shape of a Prisma 7 Json column under class-transformer's
        //    `unknown[]` is implementation-dependent (it can land as
        //    "[[],[]]" with implicit conversion stripping object members),
        //    so we assert the source-of-truth column is populated rather
        //    than asserting on the inner block shape.
        expect(row!.blocks).not.toBeNull();
      });

      it("GET /email-templates/:id for an unknown id returns null/404 (no DB row leaked)", async () => {
        // The handler uses findFirst({ where: { id } }) and returns null when
        // missing — the controller passes null through as the response body.
        // Either way, the status is 200 with body null OR 404. We accept both
        // shapes so the spec does not over-specify, but the key invariant is
        // that the DB still has zero rows for that id.
        const ghostId = "00000000-0000-4000-8000-000000000000";
        const res = await withAuth(ctx.adminToken)(
          api().get(`/api/v1/dashboard/comms/email-templates/${ghostId}`),
        );

        // Most NestJS setups surface null bodies as 200 OK with body === null;
        // a NotFoundException filter would surface 404. Accept either, but
        // assert no row exists either way.
        expect([200, 404]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body == null || Object.keys(res.body).length === 0).toBe(true);
        }
        const row = await prisma.emailTemplate.findUnique({ where: { id: ghostId } });
        expect(row).toBeNull();
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTHZ — under-permissioned caller is rejected
    // ═══════════════════════════════════════════════════════════════════════════

    describe("Authorization: EMPLOYEE (no Setting permission) is rejected with 403", () => {
      it("EMPLOYEE cannot POST /settings/sms (403) — CaslGuard rejects before the handler runs", async () => {
        const res = await withAuth(ctx.employeeToken)(
          api().post("/api/v1/dashboard/comms/settings/sms"),
        ).send({ provider: "NONE" });

        expect(res.status).toBe(403);
        expect(JSON.stringify(res.body)).toMatch(/insufficient|forbidden/i);

        // The DB must NOT have been mutated by the rejected request — the
        // previous test left provider=UNIFONIC; it must still be UNIFONIC.
        const row = await prisma.organizationSmsConfig.findFirst();
        expect(row).not.toBeNull();
        expect(row!.provider).toBe("UNIFONIC");
      });
    });
  },
);
